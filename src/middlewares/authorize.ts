// src/middlewares/authorize.ts
import { Request, Response, NextFunction } from 'express';
import { getUserRole } from '@services/usuarios/auth.servicio';

type Role = string;

export const authorize = (...allowedRoles: Role[]) => {
    return async (req: any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = req.auth; // Asegúrate de que el JWT middleware configure `req.auth`

            if (!user) {
                res.status(401).json({ message: 'No autenticado' });
                return;
            }

            // Obtener el ID del usuario desde req.auth (ajusta según cómo esté configurado tu JWT)
            const userId = user.id_usuario;

            if (!userId) {
                res.status(401).json({ message: 'ID de usuario no encontrado' });
                return;
            }

            // Obtener el rol desde la base de datos
            const userRole = await getUserRole(userId);

            if (!userRole) {
                res.status(403).json({ message: 'Acceso prohibido - usuario sin rol asignado' });
                return;
            }

            // Verificar si el rol está permitido
            if (!allowedRoles.includes(userRole)) {
                res.status(403).json({ message: 'Acceso prohibido - rol no autorizado' });
                return;
            }

            next();
        } catch (error) {
            console.error('Error en authorize:', error);
            res.status(500).json({ message: 'Error interno al verificar autorización' });
        }
    };
};