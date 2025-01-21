import { createLogger, format, transports, Logform } from 'winston';
import { Sequelize, DataTypes, Model } from 'sequelize';
import crypto from 'crypto';
import Transport from 'winston-transport';
import { DB_DIALECT, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from "@db/config";
// 🔗 Conectar a la base de datos (configura con tus credenciales)
const sequelize = new Sequelize({
    host: DB_HOST,
    port: Number(DB_PORT),
    username: DB_USER,
    password: DB_PASSWORD,
    database: "logsDB",
    dialect: DB_DIALECT as any, // Usa la variable de entorno para el dialecto (postgres, mysql, etc.)
    logging: false, // Desactiva el log de las consultas SQL
    define: {
        freezeTableName: true, // No cambia los nombres de tablas
        timestamps: false,     // Desactiva timestamps automáticos
    },
    dialectOptions: {
        ...(DB_DIALECT === 'mysql' && {
            // Opciones para MySQL, como SSL u otros parámetros
        }),
        ...(DB_DIALECT === 'postgres' && {
            // Opciones específicas de PostgreSQL
        })
    }
});

// 🔍 Modelo de logs (para CRUDs, autenticación y seguridad)
class LogEntry extends Model { }
LogEntry.init(
    {
        level: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        meta: { type: DataTypes.JSON },
        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        hash: { type: DataTypes.STRING, allowNull: false }, // Firma hash
    },
    { sequelize, modelName: 'LogEntry' }
);

// 📌 Función para generar un hash SHA-256 (No repudio)
const generateHash = (log: object): string => {
    return crypto.createHash('sha256').update(JSON.stringify(log)).digest('hex');
};
// 📌 Implementar transportador personalizado para Winston y Sequelize
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
                console.error('Error guardando log en la base de datos:', err);
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
        //new transports.Console(),
        new transports.File({ filename: 'logs/system.log' }),
        new SequelizeTransport(), // 🚀 Guardar en base de datos
    ],
});

// 🗄️ Sincronizar modelos
sequelize.sync();

export { logger };
