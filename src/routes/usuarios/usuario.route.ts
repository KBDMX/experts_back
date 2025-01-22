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

            if (usuario) {
                // Elimina el campo password del objeto
                const { pass, ...usuarioSinPassword } = usuario;
                res.status(200).json({
                    ok: true,
                    data: usuarioSinPassword
                });
            } else {
                res.status(404).json({
                    ok: false,
                    msg: 'Usuario no encontrado'
                });
            }
        } else {
            const usuarios = await getUsuarios();
            // Elimina el campo password de cada usuario en la lista
            const usuariosSinPassword = usuarios.map(({ pass, ...resto }) => resto);

            res.status(200).json({
                ok: true,
                data: usuariosSinPassword
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
            res.status(200).json({ ok: true, msg: 'Actualizando rol de usuario' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;