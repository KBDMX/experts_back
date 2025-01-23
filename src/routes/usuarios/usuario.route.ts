// usuarios.routes.ts
import express, { Request, Response, NextFunction } from 'express';
import { getUsuario, getUsuarios } from '@services/usuarios/usuarios.servicio';
import { updateRolUsuario, deleteUser } from '@services/usuarios/admins.servicio';
import { body, param } from 'express-validator';
import validationMiddleware from '@middlewares/validationMiddleware';
import { logUsuariosService } from '@utils/logger'; // Ajusta la ruta de tu import

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
                const { pass, ...usuarioSinPassword } = usuario;

                // Registrar en la nueva tabla:
                logUsuariosService(req, 'Get usuario by ID', { userIdBuscado: id });

                res.status(200).json({
                    ok: true,
                    data: usuarioSinPassword,
                });
            } else {
                res.status(404).json({
                    ok: false,
                    msg: 'Usuario no encontrado',
                });
            }
        } else {
            const usuarios = await getUsuarios();
            const usuariosSinPassword = usuarios.map(({ pass, ...resto }) => resto);

            // Registrar en la nueva tabla:
            logUsuariosService(req, 'Get todos los usuarios', {
                totalUsuarios: usuariosSinPassword.length,
            });

            res.status(200).json({
                ok: true,
                data: usuariosSinPassword,
            });
        }
    } catch (error: any) {
        next(error);
    }
});

// PUT /usuarios
router.put(
    '/',
    [
        body('id_usuario').isUUID().withMessage('ID de usuario no sigue el formato UUID'),
        body('rol').isString().withMessage('El rol debe ser un string'),
    ],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await updateRolUsuario(req.body.id_usuario, req.body.rol);

            // Registrar el evento
            logUsuariosService(req, 'Actualizar rol', {
                userIdActualizado: req.body.id_usuario,
                nuevoRol: req.body.rol,
            });

            res.status(200).json({ ok: true, msg: 'Actualizado rol de usuario' });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /usuarios/:id_usuario
router.delete(
    '/:id_usuario',
    [param('id_usuario').isUUID().withMessage('ID de usuario no sigue el formato UUID')],
    validationMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id_usuario } = req.params;
            await deleteUser(id_usuario as any);

            // Registrar el evento
            logUsuariosService(req, 'Eliminar usuario', {
                userIdEliminado: id_usuario,
            });

            res.json({ ok: true, msg: 'Usuario eliminado' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
