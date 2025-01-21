import { createLogger, format, transports, Logform } from 'winston';
import { Sequelize, DataTypes, Model } from 'sequelize';
import crypto from 'crypto';
import Transport from 'winston-transport';
import { DB_DIALECT, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from "@db/config";

// 🔗 Función para crear la base de datos si no existe
async function createDatabaseIfNotExists() {
    const tempSequelize = new Sequelize({
        host: DB_HOST,
        port: Number(DB_PORT),
        username: DB_USER,
        password: DB_PASSWORD,
        dialect: DB_DIALECT as any,
        logging: false
    });

    try {
        await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS logsDB`);
        console.log('✅ Base de datos verificada/creada exitosamente');
    } catch (error) {
        console.error('❌ Error al crear la base de datos:', error);
    } finally {
        await tempSequelize.close();
    }
}

// Ejecutar la creación de la base de datos
createDatabaseIfNotExists().catch(console.error);

// 🔗 Conectar a la base de datos
const sequelize = new Sequelize({
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
    },
    dialectOptions: {
        ...(DB_DIALECT === 'mysql' && {
            // Opciones para MySQL
        }),
        ...(DB_DIALECT === 'postgres' && {
            // Opciones para PostgreSQL
        })
    }
});

// 🔍 Modelo de logs
class LogEntry extends Model { }
LogEntry.init(
    {
        level: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        meta: { type: DataTypes.JSON },
        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        hash: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, modelName: 'LogEntry' }
);

// 📌 Función para generar hash SHA-256
const generateHash = (log: object): string => {
    return crypto.createHash('sha256').update(JSON.stringify(log)).digest('hex');
};

// 📌 Transportador personalizado para Winston y Sequelize
class SequelizeTransport extends Transport {
    constructor(opts?: Transport.TransportStreamOptions) {
        super(opts);
    }

    log(info: Logform.TransformableInfo, callback: () => void) {
        setImmediate(async () => {
            try {
                await LogEntry.create({
                    level: info.level,
                    message: info.message,
                    meta: info.meta || {},
                    hash: generateHash(info),
                });
            } catch (err) {
                console.error('❌ Error guardando log en la base de datos:', err);
            }
        });
        callback();
    }
}

// 🎯 Configuración del logger con Winston
const logger = createLogger({
    level: 'info',
    format: format.combine(format.timestamp(), format.json()),
    transports: [
        new transports.File({ filename: 'logs/system.log' }),
        new SequelizeTransport(),
    ],
});

// 🗄️ Sincronizar modelos y verificar conexión
sequelize.authenticate()
    .then(() => {
        console.log('✅ Conexión establecida correctamente');
        return sequelize.sync();
    })
    .then(() => {
        console.log('✅ Modelos sincronizados correctamente');
    })
    .catch(error => {
        console.error('❌ Error durante la inicialización:', error);
    });

export { logger };