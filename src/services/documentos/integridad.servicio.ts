import { DocumentoBaseAttributes, DocumentoBaseCreationAttributes } from "@models/documentos/documentos_base/documento_base.model";
import { createHash } from "crypto";

export interface DiscrepanciaHash {
    documentoId: number;
    fecha: string;
    hashAlmacenado: string;
    hashCalculado: string;
}

export async function notificarDiscrepanciaHash(discrepancia: DiscrepanciaHash): Promise<void> {
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

<<<<<<< HEAD
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
=======
    
>>>>>>> 3561b04ec4f16ebfab2857311ed910dd6819cb7c
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
    
    return {
        esValido: documento.hash === hashCalculado,
        hashAlmacenado: documento.hash,
        hashCalculado: hashCalculado
    };
}