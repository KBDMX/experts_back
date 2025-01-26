import GuiaHija from "@models/documentos/centro_guias/guias_hija.model";

import { DataTypes, Model } from "sequelize";



export async function createGuiaHija(guia_hija: GuiaHija): Promise<GuiaHija> {
    const { id_coordinacion, id_finca, id_producto, id_cliente, peso } = guia_hija;
    const guiaHija = await GuiaHija.create({
        id_coordinacion,
        id_finca,
        id_producto,
        id_cliente,
        peso,
    });

    return guiaHija;
}

export async function getGuiasHijas(): Promise<GuiaHija[]> {
    const guiasHijas = await GuiaHija.findAll();
    return guiasHijas;
}

export async function getGuiaHijaById(id: number): Promise<GuiaHija | null> {
    const guiaHija = await GuiaHija.findByPk(id);
    return guiaHija;
}

export async function updateGuiaHija(id: number, guia_hija: GuiaHija): Promise<GuiaHija | null> {
    const { id_coordinacion, id_finca, id_producto, id_cliente, peso } = guia_hija;
    const guiaHija = await GuiaHija.findByPk(id);
    if (guiaHija) {
        guiaHija.id_coordinacion = id_coordinacion;
        guiaHija.id_finca = id_finca;
        guiaHija.id_producto = id_producto;
        guiaHija.id_cliente = id_cliente;
        guiaHija.peso = peso;

        await guiaHija.save();
    }

    return guiaHija;
}

export async function deleteGuiaHija(id: number): Promise<boolean> {
    const guiaHija = await GuiaHija.findByPk(id);
    if (guiaHija) {
        await guiaHija.destroy();
        return true;
    }

    return false;
}

export async function getGuiasHijasByCoordinacion(id_coordinacion: number): Promise<GuiaHija[]> {
    const guiasHijas = await GuiaHija.findAll({
        where: {
            id_coordinacion,
        },
    });

    return guiasHijas;
}