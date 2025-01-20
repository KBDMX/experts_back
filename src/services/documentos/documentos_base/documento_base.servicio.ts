import DocumentoBase from "@models/documentos/documentos_base/documento_base.model";
import GuiaMadre, { GuiaMadreAttributes } from "@models/documentos/documentos_base/guia_madre.model";
import sequelize from "@db/experts.db";
import { DocumentoBaseAttributes, DocumentoBaseCreationAttributes } from "@models/documentos/documentos_base/documento_base.model";
import Aerolineas from "@models/mantenimiento/aerolinea.model";
import AgenciaIata from "@models/mantenimiento/agencia_iata";
import DocumentoBaseStock from "@models/catalogos/documentos/documento_base_stock";
import { createHash } from 'crypto';


export async function getDocumentosBase(page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const offset = (page - 1) * pageSize; // Calcular el desplazamiento (offset)
    const limit = pageSize; // Número de resultados por página

    // Obtener los documentos base con paginación
    const { rows, count } = await DocumentoBase.findAndCountAll({
        limit,
        offset
    });

    return {
        data: rows, // Los documentos de la página actual
        total: count // El número total de documentos
    };
}


export async function getDocumentoBase(id: number): Promise<{
    documento: DocumentoBaseAttributes | null,
    integridad?: VerificacionHash
}> {
    const documento = await DocumentoBase.findByPk(id) as DocumentoBaseAttributes | null;
    
    if (!documento) {
        return { documento: null };
    }

    // Verificar integridad
    const integridad = await verificarIntegridadDocumento(documento);
    
    // Si hay discrepancia, notificar al administrador
    if (!integridad.esValido) {
        await notificarDiscrepanciaHash({
            documentoId: documento.id,
            fecha: documento.fecha,
            ...integridad
        });
    }

    return { documento, integridad };
}

interface DiscrepanciaHash {
    documentoId: number;
    fecha: string;
    hashAlmacenado: string;
    hashCalculado: string;
}

async function notificarDiscrepanciaHash(discrepancia: DiscrepanciaHash): Promise<void> {
    // Aquí implementarías la lógica de notificación según tu sistema
    // Por ejemplo, podrías:
    // 1. Guardar en una tabla de logs
    // 2. Enviar un email


    
    console.error('¡ALERTA! Discrepancia detectada en hash de documento:', {
        mensaje: 'Se ha detectado una modificación no autorizada en el documento',
        documentoId: discrepancia.documentoId,
        fecha: discrepancia.fecha,
        hashAlmacenado: discrepancia.hashAlmacenado,
        hashCalculado: discrepancia.hashCalculado,
        fechaDeteccion: new Date().toISOString()
    });

    // Aquí puedes implementar tu lógica de notificación preferida
    // Por ejemplo, si tienes un servicio de notificaciones:
    /*
    await NotificacionService.crear({
        tipo: 'ALERTA_SEGURIDAD',
        severidad: 'ALTA',
        mensaje: `Discrepancia en hash detectada - Documento ID: ${discrepancia.documentoId}`,
        detalles: JSON.stringify(discrepancia),
        fechaDeteccion: new Date()
    });
    */
}




/********************************************** */

export async function createDocumentoBase(documento_base: DocumentoBaseCreationAttributes) {
    const hash = generarDocumentoHash(documento_base);
    return await DocumentoBase.create({ 
        ...documento_base, 
        hash,
        createdAt: new Date(), 
        updatedAt: new Date() 
    });
}

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

export async function deleteDocumentosBase(ids: any[]) {
    await DocumentoBase.destroy({
        where: {
            id: ids
        }
    });
}


/**********PARA EL HASH************/
function generarDocumentoHash(documento: DocumentoBaseAttributes | DocumentoBaseCreationAttributes): string {
    const relevantData = {
        fecha: documento.fecha,
        id_aerolinea: documento.id_aerolinea,
        id_referencia: documento.id_referencia,
        id_stock: documento.id_stock,
        timestamp: new Date().getTime()
    };
    
    return createHash('sha256')
        .update(JSON.stringify(relevantData))
        .digest('hex');
}

interface VerificacionHash {
    esValido: boolean;
    hashAlmacenado: string;
    hashCalculado: string;
}

async function verificarIntegridadDocumento(documento: DocumentoBaseAttributes): Promise<VerificacionHash> {
    // Recalcular el hash
    const hashCalculado = generarDocumentoHash(documento);
    
    return {
        esValido: documento.hash === hashCalculado,
        hashAlmacenado: documento.hash,
        hashCalculado: hashCalculado
    };
}



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

export async function previewDocumentoBaseYGuias(
    documento_base: DocumentoBaseCreationAttributes,
    n_guias: number,
    secuencial_inicial: number,
    prefijo: number
): Promise<any> {
    const documento_base_creado = { ...documento_base, createdAt: new Date(), updatedAt: new Date() };

    // Obtener el último documento base para determinar el siguiente ID (opcional)
    const last_documento_base: any = await DocumentoBase.findOne({ order: [['id', 'DESC']] });

    if (last_documento_base) {
        documento_base_creado.id = last_documento_base.id + 1;
    } else {
        documento_base_creado.id = 1;
    }

    // Generar los secuenciales siguiendo la lógica especificada
    const secuenciales = generarSecuenciales(secuencial_inicial, n_guias);

    // Simular las guías madre
    const guias = secuenciales.map(sec => ({
        id_documento_base: documento_base_creado.id, // Actualizamos a un ID simulado
        prefijo: prefijo,
        secuencial: sec,
    }));

    return { ...documento_base_creado, guias_madre: guias };
}

export async function getGuiasMadre(id_documento_base: number): Promise<GuiaMadreAttributes[]> {
    return await GuiaMadre.findAll({ where: { id_documento_base } }) as any as GuiaMadreAttributes[];
}

export async function getGuiasBase(page: number = 1, pageSize: number = 10): Promise<{ data: any[], total: number }> {
    const offset = (page - 1) * pageSize; // Calcular el desplazamiento (offset)
    const limit = pageSize; // Número de resultados por página

    // Obtener todas las guías base con sus guías madre y aplicar paginación
    const { rows, count } = await DocumentoBase.findAndCountAll({
        include: [
            {
                model: GuiaMadre,
                as: 'guias_madre'
            },
            {
                model: Aerolineas,
                as: 'aerolinea'
            },
            {
                model: AgenciaIata,
                as: 'referencia'
            },
            {
                model: DocumentoBaseStock,
                as: 'stock'
            }
        ],
        limit,
        offset
    });

    // Devolver los resultados paginados junto con el número total de registros
    return {
        data: rows, // Los registros de la página actual
        total: count // El número total de registros (sin paginación)
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