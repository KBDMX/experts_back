import DocumentoBase from "@models/documentos/documentos_base/documento_base.model";
import GuiaMadre, { GuiaMadreAttributes } from "@models/documentos/documentos_base/guia_madre.model";
import sequelize from "@db/experts.db";
import { DocumentoBaseAttributes, DocumentoBaseCreationAttributes } from "@models/documentos/documentos_base/documento_base.model";
import Aerolineas from "@models/mantenimiento/aerolinea.model";
import AgenciaIata from "@models/mantenimiento/agencia_iata";
import DocumentoBaseStock from "@models/catalogos/documentos/documento_base_stock";
import { generarDocumentoHash, notificarDiscrepanciaHash, VerificacionHash, verificarIntegridadDocumento } from "../integridad.servicio";

/**
 * Obtiene documentos base con paginación y verifica su integridad
 */
export async function getDocumentosBase(page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const { rows, count } = await DocumentoBase.findAndCountAll({
        limit,
        offset
    });

    // Verificar la integridad de los documentos obtenidos
    for (const documento of rows) {
        const integridad = await verificarIntegridadDocumento(documento.get({ plain: true }));
        if (!integridad.esValido) {
            await notificarDiscrepanciaHash({
                documentoId: (documento as any).id,
                fecha: (documento as any).fecha,
                ...integridad
            });
        }
    }

    return {
        data: rows,
        total: count
    };
}

/**
 * Obtiene un documento base por ID y verifica su integridad
 */
export async function getDocumentoBase(id: number): Promise<{ documento: DocumentoBaseAttributes | null, integridad?: VerificacionHash }> {
    const documento = await DocumentoBase.findByPk(id) as DocumentoBaseAttributes | null;

    if (!documento) {
        return { documento: null };
    }

    const integridad = await verificarIntegridadDocumento(documento);

    if (!integridad.esValido) {
        await notificarDiscrepanciaHash({
            documentoId: documento.id,
            fecha: documento.fecha,
            ...integridad
        });
    }

    return { documento, integridad };
}

/**
 * Crea un documento base y almacena su hash de integridad
 */
export async function createDocumentoBase(documento_base: DocumentoBaseCreationAttributes) {
    const hash = generarDocumentoHash(documento_base);
    return await DocumentoBase.create({
        ...documento_base,
        hash,
        createdAt: new Date(),
        updatedAt: new Date()
    });
}

/**
 * Actualiza un documento base y recalcula su hash de integridad
 */
export async function updateDocumentoBase(documento_base: DocumentoBaseAttributes) {
    const documento_baseToUpdate = await DocumentoBase.findByPk(documento_base.id);
    if (documento_baseToUpdate) {
        const { createdAt, ...updateData } = documento_base;
        const hash = generarDocumentoHash(updateData);

        await DocumentoBase.update(
            {
                ...updateData,
                hash,
                updatedAt: new Date()
            },
            {
                where: {
                    id: documento_base.id
                }
            }
        );

        return await DocumentoBase.findByPk(documento_base.id);
    }
    return null;
}

/**
 * Elimina documentos base
 */
export async function deleteDocumentosBase(ids: number[]) {
    await DocumentoBase.destroy({
        where: {
            id: ids
        }
    });
}

/**
 * Crea un documento base y sus guías asociadas, asegurando la integridad de los datos
 */
export async function crearDocumentoYGuias(
    documento_base: DocumentoBaseCreationAttributes,
    n_guias: number,
    secuencial_inicial: number,
    prefijo: number
): Promise<DocumentoBaseAttributes> {
    const t = await sequelize.transaction();
    try {
        const hash = generarDocumentoHash(documento_base);

        const documento_base_creado: DocumentoBaseAttributes = (await DocumentoBase.create(
            {
                ...documento_base,
                hash,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            { transaction: t }
        )).get({ plain: true });

        const secuenciales = generarSecuenciales(secuencial_inicial, n_guias);

        const guiasPromises = secuenciales.map(sec => GuiaMadre.create({
            id_documento_base: documento_base_creado.id,
            prefijo: prefijo,
            secuencial: sec,
        }, { transaction: t }));

        await Promise.all(guiasPromises);

        await t.commit();
        return documento_base_creado;
    } catch (error) {
        await t.rollback();
        throw error;
    }
}

/**
 * Simula la creación de un documento base y sus guías para vista previa
 */
export async function previewDocumentoBaseYGuias(
    documento_base: DocumentoBaseCreationAttributes,
    n_guias: number,
    secuencial_inicial: number,
    prefijo: number
): Promise<any> {
    const documento_base_creado = { ...documento_base, createdAt: new Date(), updatedAt: new Date() };

    const last_documento_base: any = await DocumentoBase.findOne({ order: [['id', 'DESC']] });

    if (last_documento_base) {
        documento_base_creado.id = last_documento_base.id + 1;
    } else {
        documento_base_creado.id = 1;
    }

    const secuenciales = generarSecuenciales(secuencial_inicial, n_guias);

    const guias = secuenciales.map(sec => ({
        id_documento_base: documento_base_creado.id,
        prefijo: prefijo,
        secuencial: sec,
    }));

    return { ...documento_base_creado, guias_madre: guias };
}

/**
 * Obtiene las guías madre asociadas a un documento base
 */
export async function getGuiasMadre(id_documento_base: number): Promise<GuiaMadreAttributes[]> {
    return await GuiaMadre.findAll({ where: { id_documento_base } }) as any as GuiaMadreAttributes[];
}

/**
 * Obtiene todas las guías base con paginación y relaciones, y verifica su integridad
 */
export async function getGuiasBase(page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const { rows, count } = await DocumentoBase.findAndCountAll({
        include: [
            { model: GuiaMadre, as: 'guias_madre' },
            { model: Aerolineas, as: 'aerolinea' },
            { model: AgenciaIata, as: 'referencia' },
            { model: DocumentoBaseStock, as: 'stock' }
        ],
        limit,
        offset
    });

    // Verificar la integridad de los documentos base obtenidos
    for (const documento of rows) {
        const integridad = await verificarIntegridadDocumento(documento.get({ plain: true }));
        if (!integridad.esValido) {
            await notificarDiscrepanciaHash({
                documentoId: (documento as any).id,
                fecha: (documento as any).fecha,
                ...integridad
            });
        }
    }

    return {
        data: rows,
        total: count
    };
}


/**
 * Genera una lista de secuenciales siguiendo una lógica específica:
 * - Suma 11 en cada incremento.
 * - Si el último dígito es 6, suma 4 en lugar de 11.
 * 
 * @param inicial - El secuencial inicial.
 * @param cantidad - La cantidad de secuenciales a generar.
 * @returns Un arreglo de secuenciales generados.
 */
function generarSecuenciales(inicial: number, cantidad: number): number[] {
    const secuenciales: number[] = [];
    let actual = inicial;

    for (let i = 0; i < cantidad; i++) {
        secuenciales.push(actual);
        const ultimoDigito = actual % 10;

        if (ultimoDigito === 6) {
            actual += 4;
        } else {
            actual += 11;
        }
    }

    return secuenciales;
}
