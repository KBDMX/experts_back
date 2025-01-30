import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logWithStore } from '@utils/logger';

// Configuración base del rate limit
const baseRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite por IP
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Excluir peticiones OPTIONS y documentación
        return req.method === 'OPTIONS' || req.path === '/api-docs';
    },
    handler: (req, res) => {
       

        res.status(429).json({
            error: 'Demasiadas solicitudes, intente nuevamente más tarde'
        });
    }
});

// Lista de rutas críticas
const CRITICAL_PATHS = [
    '/api/v1/aerolineas',
    '/api/v1/paises',
    '/api/v1/origenes',
    '/api/v1/aduanas',
    '/api/v1/usuarios',
    '/api/v1/documentos_base'
];

// Middleware de rate limit inteligente
export const smartRateLimit = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Verificar si la ruta actual es crítica
        const isCritical = CRITICAL_PATHS.some(path => req.path.startsWith(path));

        // Aplicar rate limit solo a rutas críticas
        if (isCritical) {
            baseRateLimiter(req, res, next);
        } else {
            next();
        }
    };
};