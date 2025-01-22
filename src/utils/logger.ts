import { createLogger, format, transports, Logform } from 'winston';
import { Sequelize, DataTypes, Model } from 'sequelize';
import crypto from 'crypto';
import Transport from 'winston-transport';
import { DB_DIALECT, DB_HOST, DB_USER, DB_PASSWORD, DB_PORT } from "@db/config";
import mainSequelize from "@db/experts.db";

// 🔗 Conectar a logsDB
const logsSequelize = new Sequelize({
    host: DB_HOST,
    port: Number(DB_PORT),
    username: DB_USER,
    password: DB_PASSWORD,
    database: "logsDB",
    dialect: DB_DIALECT as any,
    logging: false,
    define: {
        freezeTableName: true,
        timestamps: false,
    }
});

// ===========================================================
// MODELOS
// ===========================================================

// Modelo de logs que se guardan en la DB principal
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

// Modelo de integridad en logsDB
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



// ===========================================================
// HERRAMIENTAS DE INTEGRIDAD
// ===========================================================
const generateHash = (log: object): string => {
    return crypto.createHash('sha256').update(JSON.stringify(log)).digest('hex');
};

// ===========================================================
// TRANSPORTES PERSONALIZADOS
// ===========================================================

class AppLogTransport extends Transport {
    constructor(opts?: Transport.TransportStreamOptions) {
        super(opts);
    }

    log(info: Logform.TransformableInfo, callback: () => void) {
        setImmediate(async () => {
            try {
                await AppLog.create({
                    type: info.type || 'general',
                    level: info.level,
                    message: typeof info.message === 'string' ? info.message : JSON.stringify(info.message),
                    meta: JSON.stringify(info.meta),
                    timestamp: new Date(),
                });
            } catch (err) {
                console.error('❌ Error guardando log en main DB:', err);
            } finally {
                callback();
            }
        });
    }
}

class IntegrityTransport extends Transport {
    constructor(opts?: Transport.TransportStreamOptions) {
        super(opts);
    }

    log(info: Logform.TransformableInfo, callback: () => void) {
        setImmediate(async () => {
            try {
                await IntegrityLog.create({
                    level: info.level || 'info', // Asegurar que el nivel esté presente
                    message: typeof info.message === 'string' ? info.message : JSON.stringify(info.message),
                    meta: JSON.stringify(info.meta),
                    hash: generateHash(info),
                });
                console.log(`✅ Log guardado en logsDB - Nivel: ${info.level}`);
            } catch (err) {
                console.error('❌ Error guardando log en logsDB:', err);
            } finally {
                callback();
            }
        });
    }
}


// ===========================================================
// LOGGER CONFIGURABLE
// ===========================================================

const appLogger = createLogger({
    level: 'info',
    format: format.combine(format.timestamp()),
    transports: [new AppLogTransport()],
});

const integrityLogger = createLogger({
    level: 'info',
    format: format.combine(format.timestamp()),
    transports: [new IntegrityTransport()],
});

// ===========================================================
// FUNCIÓN PARA ELEGIR EL LOGGER
// ===========================================================

export const logWithStore = (data: any, store: 'app' | 'integrity') => {
    if (store === 'app') {
        appLogger.info(data);
    } else if (store === 'integrity') {
        integrityLogger.log({ level: data.level || 'info', ...data }); // Ahora usa log() en lugar de info()
    }
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
        database: "postgres", // Se debe conectar a una BD existente antes de crear `logsDB`
        dialect: DB_DIALECT as any,
        logging: false
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
        await logsSequelize.sync({ alter: true });

        await mainSequelize.authenticate();
        console.log('✅ Conexión establecida correctamente a main DB');
        await mainSequelize.sync({ alter: true });

        console.log('✅ Modelos sincronizados correctamente');
    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
    }
})();
