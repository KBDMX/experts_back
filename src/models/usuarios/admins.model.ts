import { Model, DataTypes } from 'sequelize';
import { Admin, AdminAtributosCreacion } from '@typesApp/usuarios/adminRol.type';
import sequelize from '@db/experts.db';

import Usuario from './usuario.model';

const Admin = sequelize.define<Model<Admin, AdminAtributosCreacion>>('admins_rol', {
    id_usuario: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: {
            model: Usuario,
            key: Usuario.primaryKeyAttribute,
        },
    },
    
});

export default Admin;