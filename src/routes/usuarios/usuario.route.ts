import express, { Request, Response, NextFunction } from 'express';
import { createUsuario, deleteUsuario, getUsuario, getUsuarios, updateUsuario } from '@services/usuarios/usuarios.servicio';
import { body } from 'express-validator';
import validationMiddleware from '@middlewares/validationMiddleware';
import { updateRolUsuario } from '@services/usuarios/admins.servicio';

const router = express.Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.query.id) {
            const id = Number.parseInt(req.query.id as string);
            if (isNaN(id)) {
                throw new Error('ID inválido');
            }
            const usuario = await getUsuario(id);
            res.status(200).json({
                ok: true,
                data: usuario
            });
        } else {
            const usuarios = await getUsuarios();
            res.status(200).json({
                ok: true,
                data: usuarios
            });
        }
    } catch (error: any) {
        next(error);
    }
});

// PUT /aerolineas
router.put('/',
    [
        body('id_usuario').isUUID().withMessage('ID de usuario no sigue el formato UUID'),
        body('rol').isString().withMessage('El rol debe ser un string'),
        // Añadir más validaciones según sea necesario
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await updateRolUsuario(req.body.id_usuario, req.body.rol);
            res.status(200).json({ ok: true, msg: 'Actualizando rolde usuario' });
        } catch (error) {
            next(error);
        }
    }
);
