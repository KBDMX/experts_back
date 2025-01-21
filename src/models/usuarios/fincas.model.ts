import { Model, DataTypes } from 'sequelize';
import { Finca, FincaAtributosCreacion } from '@typesApp/usuarios/fincaRol.types';
import sequelize from '@db/experts.db';

import Usuario from './usuario.model';

const Finca = sequelize.define<Model<Finca, FincaAtributosCreacion>>('fincas_rol', {
    id_usuario: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: {
            model: Usuario,
            key: Usuario.primaryKeyAttribute,
        },
    },

});

export default Finca;