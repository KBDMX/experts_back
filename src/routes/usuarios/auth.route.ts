// auth.routes.ts

import express, { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import validationMiddleware from '@middlewares/validationMiddleware';
import { initiate2FA, verify2FA, register } from '@services/usuarios/auth.servicio';
import { logAuthService } from '@utils/logger'; // Ajusta la ruta

const router = express.Router();

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
            // EJEMPLO: logueamos un "intento de login"
            logAuthService(req, 'login_attempt', { user: req.body.usuario });

            const { usuario, pass, recordar } = req.body;
            const ip = req.ip;

            const result = await initiate2FA(usuario, pass, ip as string);

            // EJEMPLO: logueamos que se envió 2FA
            logAuthService(req, '2fa_sent', {
                user: usuario,
                expiresAt: result.expiresAt,
            });

            return res.status(200).json({
                ok: true,
                msg: 'Código 2FA enviado al correo',
                tempToken: result.tempToken,
                expiresAt: result.expiresAt,
            });
        } catch (error) {
            // EJEMPLO: logueamos error en login
            logAuthService(req, 'login_failed', {
                user: req.body.usuario || 'unknown',
                error: (error as Error).message,
            });

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
            logAuthService(req, '2fa_verification_attempt');

            const { code, tempToken, recordar = false } = req.body;
            const ip = req.ip;

            if (!tempToken) {
                throw new Error('Token temporal no provisto');
            }
            const result = await verify2FA(code, tempToken, recordar, ip as string);

            if (result.isValid && result.tokens) {
                // Loguear: login exitoso
                logAuthService(req, 'login_success');

                // set cookies...
                res.cookie('access_token', result.tokens.accessToken, { /* ...opciones... */ });
                res.cookie('refresh_token', result.tokens.refreshToken, { /* ...opciones... */ });

                return res.status(200).json({ ok: true, msg: 'Autenticación exitosa' });
            }

            // Loguear: verificación fallida
            logAuthService(req, '2fa_verification_failed', {
                message: result.message,
                remainingAttempts: result.remainingAttempts,
            });

            return res.status(401).json({
                ok: false,
                msg: result.message,
                remainingAttempts: result.remainingAttempts,
                shouldRetry: result.shouldRetry,
            });
        } catch (error) {
            // Loguear: error interno
            logAuthService(req, '2fa_error', {
                error: (error as Error).message,
            });
            return next(error);
        }
    }
);

router.post('/logout', (req: Request, res: Response) => {
    logAuthService(req, 'logout');

    res.clearCookie('access_token', { /* ... */ });
    res.clearCookie('refresh_token', { /* ... */ });
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
            logAuthService(req, 'register_attempt', {
                usuario: req.body.usuario,
                email: req.body.email,
            });

            await register(req.body);

            return res.status(201).json({
                ok: true,
                msg: 'Registro exitoso',
            });
        } catch (error) {
            logAuthService(req, 'register_failed', {
                error: (error as Error).message,
            });
            return next(error);
        }
    }
);

router.get('/me', (req: Request, res: Response) => {
    // Si deseas:
    //  - Extraer userId desde la cookie, ya lo hace logAuthService. 
    //  - O, si ya tienes un middleware que agrega `req.auth`, podrías loguearlo:
    logAuthService(req, 'user_info_requested', {
        user: (req as any)?.auth?.id_usuario ?? 'desconocido',
        rol: (req as any)?.auth?.rol ?? 'desconocido',
    });

    if (!(req as any)?.auth) {
        return res.status(401).json({ ok: false, msg: 'No autenticado' });
    }

    return res.status(200).json({
        ok: true,
        user: {
            id: (req as any)?.auth?.id_usuario,
            rol: (req as any)?.auth?.rol,
        },
    });
});

export default router;
