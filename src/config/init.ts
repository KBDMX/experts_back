// db/init.ts
import sequelize from './experts.db';
import Usuario from '@models/usuarios/usuario.model';
import Admin from '@models/usuarios/admins.model';
import { hashSync } from 'bcrypt'; // Asumiendo que usas bcrypt para hashear passwords

// Método para ejecutar DELETE de tablas específicas
export const deleteOldTables = async (tables: string[]) => {
    try {
        for (const table of tables) {
            await sequelize.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
            console.log(`Tabla ${table} eliminada correctamente`);
        }
    } catch (error) {
        console.error('Error eliminando tablas antiguas:', error);
        throw error;
    }
};

export const initDatabase = async () => {
    try {
        // 1. Eliminar tablas antiguas si es necesario
        const tablesToDelete = ['admins']; // Reemplaza con las tablas necesarias
        await deleteOldTables(tablesToDelete);

        // 2. Forzar sincronización de tablas
        await sequelize.sync({ alter: true });
        
        // 3. Crear usuarios individualmente para manejar errores
        const usuariosIniciales = [
            { usuario: 'BRITANIFLOR', email: 'britanny.flores@epn.edu.ec', pass: '$2b$10$fGbQfRzi12dZi86yMdqz.uhv/fmKNBKiH.HR/8uAoe19Npd1AYFNW' },
            { usuario: 'Xavicom', email: 'xavico@gmail.com', pass: '$2b$10$0EnNF/RH1VsXCwvpwqAhJuyod8s0l1i/Z5cjv9wC0z0aqpHN9Ve7i' },
            { usuario: 'xavier', email: 'xavicarpio78@gmail.com', pass: '$2b$10$VpIAAFIBaLAP69HqJyvouORVy0SpwznZ60e1v7QRjkJd3Z9QP7cIe' },
            { usuario: 'kennyp2233', email: 'kennyp41234@gmail.com', pass: '$2b$10$BVhU9F4Ha/mxoRjuHkNMR.r2he6DcIDdKjR.jgpZ5THuLVGq35.te' }
        ];
        
        const usuariosCreados = [];
        
        for (const datos of usuariosIniciales) {
            try {
                const usuario = await Usuario.create(datos);
                usuariosCreados.push(usuario);
                console.log(`Usuario creado: ${usuario}`);
            } catch (error) {
                console.error(`Error insertando usuario ${datos.usuario}:`, error);
            }
        }

        // 4. Crear registros en admin_rol solo para los usuarios insertados correctamente
        for (const usuario of usuariosCreados) {
            try {
                await Admin.create({ id_usuario: (usuario as any).id_usuario });
                console.log(`Admin creado para usuario ${usuario}`);
            } catch (error) {
                console.error(`Error insertando admin para usuario ${usuario}:`, error);
            }
        }
        
        console.log('Base de datos inicializada con datos de ejemplo');
    } catch (error) {
        console.error('Error durante la inicialización de la base de datos:', error);
        throw error;
    }
};

// Script para ejecutar la inicialización
if (require.main === module) {
    initDatabase()
        .then(() => {
            console.log('Proceso de inicialización completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error en el proceso de inicialización:', error);
            process.exit(1);
        });
}

export default initDatabase;
