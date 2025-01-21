// db/connection.ts
import { Sequelize } from "sequelize";
import { DB_DIALECT, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from "./config";
import fs from 'fs';
import path from 'path';

const logFile = fs.createWriteStream(path.join(__dirname, 'sequelize.log'), { flags: 'a' });

const sequelize = new Sequelize({
    host: DB_HOST,
    port: Number(DB_PORT),
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    dialect: DB_DIALECT as any,
    logging: (msg) => logFile.write(msg + '\n'),
    define: {
        freezeTableName: true,
        timestamps: false,
    },
    dialectOptions: {
        ...(DB_DIALECT === 'mysql' && {}),
        ...(DB_DIALECT === 'postgres' && {})
    }
});

// Exportamos una función para sincronizar
export const syncDatabase = async () => {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database synchronized');
    } catch (err) {
        console.error('Error synchronizing database', err);
    }
};

export default sequelize;
