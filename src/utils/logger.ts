// utils/logger.ts

import { Sequelize, DataTypes, Model } from 'sequelize';
import crypto from 'crypto';
import { DB_DIALECT, DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, SECRET_KEY } from '@db/config';
import mainSequelize from '@db/experts.db';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

// (1) Conexión a logsDB (ya existente en tu código):
const logsSequelize = new Sequelize({
    host: DB_HOST,
    port: Number(DB_PORT),
    username: DB_USER,
    password: DB_PASSWORD,
    database: 'logsDB',
    dialect: DB_DIALECT as any,
    logging: false,
    define: {
        freezeTableName: true,
        timestamps: false,
    },
});

// ===========================================================
// MODELOS EXISTENTES
// ===========================================================
class AppLog extends Model { }
AppLog.init(
    {
        type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'general' },
        level: { type: DataTypes.STRING, allowNull: false, defaultValue: 'info' },
        message: { type: DataTypes.TEXT, allowNull: false },
        meta: { type: DataTypes.JSON },
        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { sequelize: mainSequelize, modelName: 'AppLog' }
);

export class IntegrityLog extends Model { }
IntegrityLog.init(
    {
        level: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        meta: { type: DataTypes.JSON },
        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        hash: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize: logsSequelize, modelName: 'IntegrityLog' }
);

export class AuthServiceLog extends Model { }
AuthServiceLog.init(
    {
        // Puedes usar un UUID en "id" o permitir que sea autoincrement
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: true, // será null si no se pudo decodificar
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        details: {
            // Aquí guardaremos JSON con más información
            type: DataTypes.JSON,
            allowNull: true,
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize: logsSequelize,
        modelName: 'AuthServiceLog',
        tableName: 'AuthServiceLog',
        timestamps: false,
    }
);

// ===========================================================
// NUEVO MODELO PARA LOGS DE USUARIOS (EN logsDB)
// ===========================================================
export class UsuariosServiceLog extends Model { }
UsuariosServiceLog.init(
    {
        // Podrías usar un UUID PK si quieres, o dejar que Sequelize cree un id autoincrement
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        details: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize: logsSequelize, // ¡Importante! Va en logsDB
        modelName: 'UsuariosServiceLog',
        tableName: 'UsuariosServiceLog', // Nombre de la tabla en la DB
        timestamps: false,
    }
);

// ===========================================================
// HERRAMIENTAS DE INTEGRIDAD
// ===========================================================
const generateHash = (log: object): string => {
    return crypto.createHash('sha256').update(JSON.stringify(log)).digest('hex');
};

// ===========================================================
// logWithStore (ya lo tienes para AppLog / IntegrityLog)
// ===========================================================
export const logWithStore = (data: any, store: 'app' | 'integrity') => {
    setImmediate(async () => {
        try {
            if (store === 'app') {
                await AppLog.create({
                    type: data.type || 'general',
                    level: data.level || 'info',
                    message:
                        typeof data.message === 'string'
                            ? data.message
                            : JSON.stringify(data.message),
                    meta: JSON.stringify(data.meta),
                    timestamp: new Date(),
                });
            } else if (store === 'integrity') {
                await IntegrityLog.create({
                    level: data.level || 'info',
                    message:
                        typeof data.message === 'string'
                            ? data.message
                            : JSON.stringify(data.message),
                    meta: JSON.stringify(data.meta),
                    timestamp: new Date(),
                    hash: generateHash(data),
                });
            }
        } catch (err) {
            console.error('❌ Error guardando log:', err);
        }
    });
};

export const logAuthService = (req: Request, action: string, details: any = {}) => {
    // Este helper extrae info útil de la request, decodifica la cookie si existe,
    // y guarda un registro en AuthServiceLog.
    setImmediate(async () => {
        try {
            const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || '';
            let userId = null;

            // Intentar decodificar la cookie access_token
            const { access_token } = req.cookies || {};
            if (access_token) {
                try {
                    const decoded = jwt.verify(access_token, SECRET_KEY as string) as any;
                    userId = decoded?.id_usuario || null;
                } catch {
                    // Token inválido/expirado, userId se queda en null
                }
            }

            // Combinar "details" con más información
            const combinedDetails = {
                ...details,
                method: req.method,
                url: req.originalUrl,
                ip: ip.toString(),
                userAgent,
            };

            await AuthServiceLog.create({
                userId,
                action,
                details: combinedDetails,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('❌ Error guardando AuthServiceLog:', error);
        }
    });
};

/**
 * parseAndStoreLog:
 *  - Toma el rawMessage generado por Morgan (JSON string)
 *  - Parseamos a objeto
 *  - Decodificamos si existe un access_token en req.cookies
 *  - Mandamos la info final a logWithStore
 */
export const parseAndStoreLog = (rawMessage: string, req: Request, store: 'app' | 'integrity') => {
    try {
        const data = JSON.parse(rawMessage);

        const { cookies } = req;
        data.meta = { cookies, ...(data.meta || {}) };

        if (cookies && cookies.access_token) {
            try {
                const decoded = jwt.verify(cookies.access_token, SECRET_KEY as string) as any;
                if (decoded && decoded.id_usuario) {
                    data.meta.userId = decoded.id_usuario;
                }
            } catch (error) {
                // token inválido/expirado => no pasa nada
            }
        }

        logWithStore(data, store);
    } catch (err) {
        console.error('Error parsing Morgan log:', err);
    }
};

// ===========================================================
// FUNCIÓN PARA GUARDAR LOGS ESPECÍFICOS DEL SERVICIO DE USUARIOS
// ===========================================================
export const logUsuariosService = (req: Request, action: string, details: any = {}) => {
    setImmediate(async () => {
        try {
            const { cookies } = req;
            let userId = null;
            let userRole = null;

            // Intentar decodificar la cookie para obtener id_usuario y rol
            if (cookies?.access_token) {
                try {
                    const decoded = jwt.verify(cookies.access_token, SECRET_KEY as string) as any;
                    userId = decoded?.id_usuario || null;
                    userRole = decoded?.rol || null;
                } catch (err) {
                    // token inválido/expirado, userId y userRole quedarán null
                }
            }

            // Construir un objeto con más detalles: IP, agente, método, url, etc.
            const extraInfo = {
                ip: req.ip || req.socket.remoteAddress,
                userAgent: req.headers['user-agent'] || '',
                method: req.method,
                originalUrl: req.originalUrl,
                userRole,
            };

            // Combinar con los detalles que pasas desde la ruta
            const combinedDetails = {
                ...details,
                ...extraInfo,
            };

            // Insertar el log en la tabla UsuariosServiceLog
            await UsuariosServiceLog.create({
                userId,
                action,
                details: combinedDetails,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('❌ Error guardando log del servicio de usuarios:', error);
        }
    });
};
// ===========================================================
// CREACIÓN AUTOMÁTICA DE BASE DE DATOS
// ===========================================================
export const createDatabaseIfNotExists = async (): Promise<void> => {
    const tempSequelize = new Sequelize({
        host: DB_HOST,
        port: Number(DB_PORT),
        username: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres',
        dialect: DB_DIALECT as any,
        logging: false,
    });

    try {
        const [results]: any = await tempSequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = 'logsDB'`
        );

        if (!results || results.length === 0) {
            await tempSequelize.query(`CREATE DATABASE logsDB`);
            console.log(`✅ Base de datos 'logsDB' creada exitosamente`);
        } else {
            console.log(`✅ Base de datos 'logsDB' ya existe`);
        }
    } catch (error) {
        console.error('❌ Error al crear/verificar la base de datos:', error);
    } finally {
        await tempSequelize.close();
    }
};

// ===========================================================
// SINCRONIZAR MODELOS
// ===========================================================
(async () => {
    try {
        await logsSequelize.authenticate();
        console.log('✅ Conexión establecida correctamente a logsDB');
        // Sincronizar logsDB
        await logsSequelize.sync({ alter: true });

        await mainSequelize.authenticate();
        console.log('✅ Conexión establecida correctamente a main DB');
        // Sincronizar main DB
        await mainSequelize.sync({ alter: true });

        console.log('✅ Modelos sincronizados correctamente');
    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
    }
})();
