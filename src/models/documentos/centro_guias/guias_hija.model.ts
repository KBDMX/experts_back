import sequelize from "@db/experts.db";

import { DataTypes, Model, Optional } from "sequelize";
import DocumentoCoordinacion from "./documento_coordinacion.model";
import Finca from "@models/usuarios/fincas.model";
import Producto from "@models/mantenimiento/producto.model";
import Cliente from "@models/mantenimiento/cliente.model";

// Interface original modificada
export interface GuiaHijaAttributes {
    id: number;
    id_coordinacion: number; // Corregí el typo "coorinacion"
    id_finca: number;
    id_producto: number;     // Corregí el typo "prodructo"
    id_cliente: number;
    peso: number;
}

// Interface para atributos requeridos al crear
export interface GuiaHijaCreationAttributes extends Optional<GuiaHijaAttributes, 'id'> { }


class GuiaHija extends Model<GuiaHijaAttributes, GuiaHijaCreationAttributes>
    implements GuiaHijaAttributes {
    public id!: number;
    public id_coordinacion!: number;
    public id_finca!: number;
    public id_producto!: number;
    public id_cliente!: number;
    public peso!: number;

    // Timestamps automáticos
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

GuiaHija.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    id_coordinacion: {  // Nombre correcto
        type: DataTypes.INTEGER,
        references: {
            model: DocumentoCoordinacion,
            key: "id"
        },
        allowNull: false
    },
    id_finca: {
        type: DataTypes.UUID,
        references: {
            model: Finca,
            key: "id_usuario"
        },
        allowNull: false
    },
    id_producto: {  // Nombre correcto
        type: DataTypes.INTEGER,
        references: {
            model: Producto,
            key: "id_producto"
        },
        allowNull: false
    },
    id_cliente: {
        type: DataTypes.INTEGER,
        references: {
            model: Cliente,
            key: "id_clientes"
        },
        allowNull: false
    },
    peso: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    sequelize,
    modelName: "guia_hija",
    timestamps: true
});

DocumentoCoordinacion.hasMany(GuiaHija, {
    foreignKey: 'id_coordinacion',
    as: 'guias_hijas'
});

export default GuiaHija;