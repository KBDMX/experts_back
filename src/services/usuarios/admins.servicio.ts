import Admins from "@models/usuarios/admins.model";
import Usuarios from "@models/usuarios/usuario.model";
import Finca from "@models/usuarios/fincas.model";
import "src/config/assosiations/usuario/user_admin.as";

import { Admin, AdminAtributosCreacion } from "@typesApp/usuarios/adminRol.type";
import { UUID } from "crypto";
import { Usuario } from "@typesApp/usuarios/usuario.type";
import { Model, ModelStatic } from "sequelize";

export async function getAdmins(): Promise<Admin[]> {
    const adminsList = await Admins.findAll();
    return adminsList.map((admin) => admin.toJSON()) as Admin[];
}

export async function getAdmin(id: number): Promise<Admin | null> {
    const admin = await Admins.findByPk(id);
    return admin ? admin.toJSON() as Admin : null;
}

export async function createAdmin(admin: AdminAtributosCreacion) {
    return await Admins.create(admin as any);
}

export async function updateAdmin(id: number, admin: AdminAtributosCreacion): Promise<Admin | null> {
    const adminToUpdate = await Admins.findByPk(id);
    if (adminToUpdate) {
        await Admins.update(admin, {
            where: {
                id_usuario: id
            }
        });
        const updatedAdmin = await Admins.findByPk(id);
        return updatedAdmin ? updatedAdmin.toJSON() as Admin : null;
    }
    return null;
}

export async function deleteAdmin(id: number): Promise<Admin | null> {
    const adminToDelete = await Admins.findByPk(id);

    if (adminToDelete) {
        await Admins.destroy({
            where: {
                id_usuario: id
            }
        });

        return adminToDelete.toJSON() as Admin;
    }
    return null;
}


export async function isUserAdmin(userId: UUID): Promise<boolean | null> {

    const user = await Usuarios.findOne({
        where: { id_usuario: userId },
        include: [{
            model: Admins,
            required: true
        }]
    });

    return user !== null;
}

// Definimos el tipo para nuestros modelos
type RolModel = ModelStatic<Model>;

// Definimos el diccionario de roles con el tipo correcto
const roles: { [key: string]: RolModel } = {
    "admin": Admins,
    "finca": Finca
};

export async function deleteUser(id: UUID): Promise<Usuario | null> {
    // 1. Verificar si el usuario existe en la base de datos
    const usuario = await Usuarios.findByPk(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado, no se puede eliminar');
    } 
    const rol = (usuario as any).rol; 
    // 2. Verificar si el nuevo rol existe en la definición de roles
    if (!rol || !roles[rol]) {
        await Usuarios.destroy({
            where: {
                id_usuario: id
            }
        });
        return usuario.toJSON() as Usuario;
    }
    // 3. Obtener la entidad del nuevo rol
    const Rol = roles[rol];
    // eliminamos el usuario
    await Rol.destroy({
        where: {
            id_usuario: id
        }
    });
    await Usuarios.destroy({
        where: {
            id_usuario: id
        }
    });
    return usuario.toJSON() as Usuario;
}

export async function updateRolUsuario(id: UUID, nuevoRol: string): Promise<Usuario | null> {
    console.log('id:', id, 'nuevoRol:', nuevoRol);
    try {
        // 1. Verificar si el usuario existe en la base de datos
        const usuario = await Usuarios.findByPk(id);
        if (!usuario) {
            throw new Error('Usuario no encontrado');
        }
        
        // 2. Verificar si el nuevo rol existe en la definición de roles
        if (!roles[nuevoRol]) {
            throw new Error('Rol no válido');
        }

        // 3. Obtener la entidad del nuevo rol
        const Rol = roles[nuevoRol];

        // 4. Verificar si el usuario ya tiene este rol en la base de datos
        const usuarioRolExistente = await Rol.findOne({ where: { id_usuario: id } });
        if (!usuarioRolExistente) {
            // 5. Si el usuario no tiene el nuevo rol, insertarlo en la tabla correspondiente
            await Rol.create({ id_usuario: id });
        }

        // 6. Eliminar al usuario de otros roles en los que esté presente
        for (const rol in roles) {
            if (rol !== nuevoRol) {
                const RolAEliminar = roles[rol];
                await RolAEliminar.destroy({
                    where: {
                        id_usuario: id
                    }
                });
            }
        }

        //7. Actualizar el rol del usuario
        usuario.set('rol', nuevoRol);
        await usuario.save();

        //8. Retornar el usuario actualizado
        return usuario.toJSON() as Usuario;;
    } catch (error) {
        console.error('Error al actualizar rol de usuario:', error);
        throw new Error('No se pudo actualizar el rol del usuario');
    }
}







