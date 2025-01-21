import express, { Request, Response, NextFunction } from 'express';
import { UUID } from 'crypto';
import validationMiddleware from '@middlewares/validationMiddleware';
import { body } from 'express-validator';
import { initiate2FA, verify2FA, register } from '@services/usuarios/auth.servicio';

// Extend the Request interface to include the user property
export interface CustomRequest extends Request {
    auth?: {
        id_usuario: UUID;
        rol: string;
        iat: number;
        exp: number;
    };
}

const router = express.Router();

router.post('/login',
    [
        body('usuario').exists().withMessage('Usuario no provisto'),
        body('pass').exists().withMessage('Contraseña no provista'),
        body('recordar').optional().isBoolean().withMessage('Recordar debe ser booleano')
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { usuario, pass, recordar } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

            const result = await initiate2FA(usuario, pass, ipAddress);

            return res.status(200).json({
                ok: true,
                msg: 'Código 2FA enviado al correo',
                tempToken: result.tempToken,
                expiresAt: result.expiresAt
            });
        } catch (error) {
            next(error);
            return res.status(500).json({
                ok: false,
                msg: 'Error en el servidor'
            });
        }
    });

    router.post('/verify-2fa',
        [
            body('code').exists().withMessage('Código 2FA no provisto'),
            body('tempToken').exists().withMessage('Token temporal no provisto'),
            body('recordar').optional().isBoolean().withMessage('Recordar debe ser booleano')
        ],
        validationMiddleware,
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                console.log('Iniciando verificación 2FA:', { 
                    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
                    hasCode: !!req.body.code,
                    hasTempToken: !!req.body.tempToken
                });
    
                const { code, tempToken, recordar = false } = req.body;
                const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    
                const result = await verify2FA(code, tempToken, recordar, ipAddress);
                console.log('Resultado de verificación 2FA:', {
                    isValid: result.isValid,
                    shouldRetry: result.shouldRetry,
                    remainingAttempts: result.remainingAttempts
                });
    
                if (result.isValid && result.tokens) {
                    console.log('Verificación exitosa, configurando cookies...');
                    try {
                        // Configurar cookies
                        res.cookie('access_token', result.tokens.accessToken, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            maxAge: 15 * 60 * 1000, // 15 minutos
                        });
    
                        res.cookie('refresh_token', result.tokens.refreshToken, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            maxAge: recordar ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
                        });
    
                        console.log('Cookies configuradas exitosamente');
                        return res.status(200).json({
                            ok: true,
                            msg: 'Autenticación exitosa'
                        });
                    } catch (cookieError) {
                        console.error('Error al configurar cookies:', cookieError);
                        return next(cookieError);
                    }
                }
    
                console.log('Verificación fallida:', result.message);
                return res.status(401).json({
                    ok: false,
                    msg: result.message,
                    remainingAttempts: result.remainingAttempts,
                    shouldRetry: result.shouldRetry
                });
            } catch (error) {
                console.error('Error en verify-2fa:', error);
                // No enviar dos respuestas
                return next(error);
            }
        });

router.post('/logout', (req: Request, res: Response) => {
    res.clearCookie('access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    return res.status(200).json({ ok: true, msg: 'Sesión cerrada' });
});
router.post('/register',
    [
        body('usuario').exists().withMessage('Usuario no provisto'),
        body('email').exists().withMessage('Email no provisto'),
        body('pass').exists().withMessage('Contraseña no provista'),
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const usuario = req.body;
            await register(usuario);
            return res.status(201).json({
                ok: true,
                msg: 'Registro exitoso',
            });
        } catch (error) {
            next(error);
            return res.status(500).json({
                ok: false,
                msg: 'Error en el registro'
            });
        }
    });
router.get('/me', (req: Request, res: Response) => {
    const customReq = req as CustomRequest;
    if (!customReq.auth) {
        return res.status(401).json({ ok: false, msg: 'No autenticado' });
    }

    return res.status(200).json({
        ok: true,
        user: {
            id: customReq.auth?.id_usuario,
            rol: customReq.auth?.rol
        },
    });
});

export default router;