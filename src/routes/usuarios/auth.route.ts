import express, { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';
// Extend the Request interface to include the user property
export interface CustomRequest {
    auth?: {
        id_usuario: UUID;
        rol: string;
        iat: number;
        exp: number;
        // Add other relevant fields here
    };
}
import { login, register } from '@services/usuarios/auth.servicio';
import validationMiddleware from '@middlewares/validationMiddleware';
import { body, query } from 'express-validator';
import { UUID } from 'crypto';
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
            const result = await login(usuario, pass, recordar || false, req);

            // Configurar cookies
            res.cookie('access_token', result.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000, // 15 minutos
            });

            res.cookie('refresh_token', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: recordar ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 7 días o 1 hora
            });

            logger.info({
                message: `Inicio de sesión exitoso para usuario ${usuario}`,
                meta: {
                    event: 'login',
                    userId: result.userId,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    status: 'success',
                },
            });

            res.status(200).json({
                ok: true,
                msg: 'Login exitoso',
            });
        } catch (error) {
            next(error);
        }
    });

// auth.route.ts
router.post('/logout', (req: Request, res: Response) => {
    const customReq = req as CustomRequest;
    logger.info({
        message: `Usuario ${customReq.auth?.id_usuario || 'desconocido'} cerró sesión`,
        meta: {
            event: 'logout',
            userId: customReq.auth?.id_usuario || 'unknown',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        },
    });

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
    res.status(200).json({ ok: true, msg: 'Sesión cerrada' });
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
            const newUser = await register(usuario);

            logger.info({
                message: `Nuevo usuario registrado: ${usuario.usuario}`,
                meta: {
                    event: 'register',
                    //  userId: newUser.id,
                    email: usuario.email,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                },
            });

            res.status(201).json({
                ok: true,
                msg: 'Registro exitoso',
            });
        } catch (error) {
            logger.error({
                message: `Error al registrar usuario ${req.body.usuario}`,
                meta: {
                    event: 'register_failed',
                    email: req.body.email || 'unknown',
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    error: (error as Error).message,
                },
            });

            next(error);
        }
    }
);

// Ruta para obtener la información del usuario autenticado
router.get('/me', (req: Request, res: Response, next: NextFunction) => {
    const customReq = req as CustomRequest;
    //console.log(customReq.auth);
    if (!customReq.auth) {
        res.status(401).json({ ok: false, msg: 'No autenticado' });
    }

    // Aquí puedes personalizar la respuesta con la información que desees
    res.status(200).json({
        ok: true,
        user: {
            id: customReq.auth?.id_usuario,
            rol: customReq.auth?.rol
            // Otros campos relevantes
        },
    });
});



export default router;
