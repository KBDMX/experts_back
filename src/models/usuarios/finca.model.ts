import { Model, DataTypes } from 'sequelize';
import { Finca, FincaAtrubutosCreacion } from '@typesApp/usuarios/fincas.types';
import sequelize from '@db/experts.db';

import Usuario from './usuario.model';


const Finca = sequelize.define<Model<Finca, FincaAtrubutosCreacion>>('fincas', {
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