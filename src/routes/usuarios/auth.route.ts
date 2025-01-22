import express, { Request, Response, NextFunction } from 'express';
import { UUID } from 'crypto';
import validationMiddleware from '@middlewares/validationMiddleware';
import { body } from 'express-validator';
import { initiate2FA, verify2FA, register } from '@services/usuarios/auth.servicio';
import { logWithStore } from '@utils/logger'; // Se usa logWithStore en lugar de logger directamente

export interface CustomRequest extends Request {
    auth?: {
        id_usuario: UUID;
        rol: string;
        iat: number;
        exp: number;
    };
}

const router = express.Router();

// 🔹 Middleware global para loggear todas las peticiones en AppLog
router.use((req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown').toString();

    logWithStore({
        type: 'request',
        method: req.method,
        url: req.url,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
    }, 'app');

    next();
});

router.post(
    '/login',
    [
        body('usuario').exists().withMessage('Usuario no provisto'),
        body('pass').exists().withMessage('Contraseña no provista'),
        body('recordar').optional().isBoolean().withMessage('Recordar debe ser booleano'),
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { usuario, pass, recordar } = req.body;
            const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown').toString();

            logWithStore({
                type: 'auth',
                action: 'login_attempt',
                user: usuario,
                ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString(),
            }, 'app');

            const result = await initiate2FA(usuario, pass, ip);

            logWithStore({
                type: 'auth',
                action: '2fa_sent',
                user: usuario,
                expiresAt: result.expiresAt,
                timestamp: new Date().toISOString(),
            }, 'app');

            return res.status(200).json({
                ok: true,
                msg: 'Código 2FA enviado al correo',
                tempToken: result.tempToken,
                expiresAt: result.expiresAt,
            });
        } catch (error) {
            logWithStore({
                type: 'auth',
                action: 'login_failed',
                user: req.body.usuario || 'unknown',
                error: (error as Error).message,
                ip: req.ip,
                timestamp: new Date().toISOString(),
            }, 'app');

            return next(error);
        }
    }
);

router.post(
    '/verify-2fa',
    [
        body('code').exists().withMessage('Código 2FA no provisto'),
        body('tempToken').exists().withMessage('Token temporal no provisto'),
        body('recordar').optional().isBoolean().withMessage('Recordar debe ser booleano'),
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { code, tempToken, recordar = false } = req.body;
            const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown').toString();

            logWithStore({
                type: 'auth',
                action: '2fa_verification_attempt',
                ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString(),
            }, 'app');

            const result = await verify2FA(code, tempToken, recordar, ip);

            if (result.isValid && result.tokens) {
                logWithStore({
                    type: 'auth',
                    action: 'login_success',
                    ip,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString(),
                }, 'app');

                res.cookie('access_token', result.tokens.accessToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 15 * 60 * 1000, // 15 minutos
                    path: '/',
                });

                res.cookie('refresh_token', result.tokens.refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: recordar ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
                    path: '/',
                });

                return res.status(200).json({
                    ok: true,
                    msg: 'Autenticación exitosa',
                });
            }

            logWithStore({
                type: 'auth',
                action: '2fa_verification_failed',
                message: result.message,
                remainingAttempts: result.remainingAttempts,
                timestamp: new Date().toISOString(),
            }, 'app');

            return res.status(401).json({
                ok: false,
                msg: result.message,
                remainingAttempts: result.remainingAttempts,
                shouldRetry: result.shouldRetry,
            });
        } catch (error) {
            logWithStore({
                type: 'auth',
                action: '2fa_error',
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
            }, 'app');

            return next(error);
        }
    }
);

router.post('/logout', (req: Request, res: Response) => {
    const customReq = req as CustomRequest;

    logWithStore({
        type: 'auth',
        action: 'logout',
        user: customReq.auth?.id_usuario || 'Desconocido',
        timestamp: new Date().toISOString(),
    }, 'app');

    res.clearCookie('access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    });

    res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    });

    return res.status(200).json({ ok: true, msg: 'Sesión cerrada' });
});

router.post(
    '/register',
    [
        body('usuario').exists().withMessage('Usuario no provisto'),
        body('email').exists().withMessage('Email no provisto'),
        body('pass').exists().withMessage('Contraseña no provista'),
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const usuario = req.body;

            logWithStore({
                type: 'auth',
                action: 'register_attempt',
                email: usuario.email,
                usuario: usuario.usuario,
                timestamp: new Date().toISOString(),
            }, 'app');

            await register(usuario);

            return res.status(201).json({
                ok: true,
                msg: 'Registro exitoso',
            });
        } catch (error) {
            logWithStore({
                type: 'auth',
                action: 'register_failed',
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
            }, 'app');

            return next(error);
        }
    }
);

router.get('/me', (req: Request, res: Response) => {
    const customReq = req as CustomRequest;

    if (!customReq.auth) {
        logWithStore({
            type: 'auth',
            action: 'unauthorized_access_attempt',
            ip: req.ip,
            timestamp: new Date().toISOString(),
        }, 'app');

        return res.status(401).json({ ok: false, msg: 'No autenticado' });
    }

    logWithStore({
        type: 'auth',
        action: 'user_info_requested',
        user: customReq.auth.id_usuario,
        rol: customReq.auth.rol,
        timestamp: new Date().toISOString(),
    }, 'app');

    return res.status(200).json({
        ok: true,
        user: {
            id: customReq.auth?.id_usuario,
            rol: customReq.auth?.rol,
        },
    });
});

export default router;
