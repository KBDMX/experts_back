import { DocumentoBaseAttributes, DocumentoBaseCreationAttributes } from "@models/documentos/documentos_base/documento_base.model";
import { createHash } from "crypto";
import { IntegrityLog, logWithStore } from "@utils/logger";
import { Op, Sequelize } from "sequelize";

export interface DiscrepanciaHash {
    documentoId: number;
    fecha: string;
    hashAlmacenado: string;
    hashCalculado: string;
}

export async function notificarDiscrepanciaHash(discrepancia: DiscrepanciaHash): Promise<void> {
    const { documentoId, hashAlmacenado, hashCalculado, fecha } = discrepancia;

    try {
        // Verificar si ya existe un log con el mismo documentoId (extraído correctamente desde JSON)
        const existingLog = await IntegrityLog.findOne({
            where: {
                message: '¡ALERTA! Discrepancia detectada en hash de documento',
                level: 'warn',
                [Op.and]: [
                    Sequelize.literal(`meta->>'documentoId' = '${documentoId}'`)
                ]
            }
        });

        if (existingLog) {
            console.log(`⚠️ Log de discrepancia ya existe para el documentoId ${documentoId}, evitando duplicación.`);
            return;
        }

        // Insertar el nuevo log solo si no existe
        await IntegrityLog.create({
            level: 'warn',
            message: '¡ALERTA! Discrepancia detectada en hash de documento',
            meta: {  // Almacenar el JSON de forma correcta sin serializar manualmente
                documentoId,
                fecha,
                hashAlmacenado,
                hashCalculado,
                fechaDeteccion: new Date().toISOString(),
            },
            timestamp: new Date(),
            hash: hashCalculado,
        });

        console.error('❌ ¡ALERTA! Discrepancia detectada en hash de documento:', discrepancia);
    } catch (error) {
        console.error('❌ Error al verificar o insertar en IntegrityLog:', error);
    }
}
/**********PARA EL HASH************/
export function generarDocumentoHash(documento: DocumentoBaseAttributes | DocumentoBaseCreationAttributes): string {
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

export interface VerificacionHash {
    esValido: boolean;
    hashAlmacenado: string;
    hashCalculado: string;
}

export async function verificarIntegridadDocumento(documento: DocumentoBaseAttributes): Promise<VerificacionHash> {
    // Recalcular el hash
    const hashCalculado = generarDocumentoHash(documento);

    const resultado = {
        esValido: documento.hash === hashCalculado,
        hashAlmacenado: documento.hash,
        hashCalculado: hashCalculado
    };

    if (!resultado.esValido) {
        await notificarDiscrepanciaHash({
            documentoId: documento.id,
            fecha: new Date().toISOString(),
            hashAlmacenado: resultado.hashAlmacenado,
            hashCalculado: resultado.hashCalculado
        });
    }

    return resultado;
}
