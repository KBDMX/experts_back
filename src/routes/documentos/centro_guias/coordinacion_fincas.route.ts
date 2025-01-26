import validationMiddleware from '@middlewares/validationMiddleware';
import {
    getDocumentosCoordinacionByFinca,

} from '@services/documentos/centro_guias/documento_coordinacion.servicio';

import { createGuiaHija } from '@services/documentos/centro_guias/guias_hijas.servicio';
import { getClientes } from '@services/mantenimiento/clientes.servicio';
import { getProductos } from '@services/mantenimiento/productos.servicio';
import { Router } from 'express';
import { query } from 'express-validator';

const router = Router();

// Obtener documentos de coordinación por Guías Hijas sin paginacion
router.get('/',
    [],
    validationMiddleware,
    async (req: any, res: any, next: any) => {

        try {

            const id_finca = req.auth?.id_usuario || null;

            const response = await getDocumentosCoordinacionByFinca(id_finca);
            res.json(response);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/clientes',
    [],
    validationMiddleware,
    async (req: any, res: any, next: any) => {

        try {

            const response = await getClientes();
            res.json(response);
        } catch (error) {
            next(error);
        }
    }
);

router.get('/productos',
    [],
    validationMiddleware,
    async (req: any, res: any, next: any) => {

        try {

            const response = await getProductos();
            res.json(response);
        } catch (error) {
            next(error);
        }
    }
);

// Crear Guía Hija
router.post('/',
    async (req: any, res: any, next: any) => {
        try {
            const guiaHija = req.body;
            guiaHija.id_finca = req.auth?.id_usuario;

            const response = await createGuiaHija(guiaHija);
            res.json(response);
        } catch (error) {
            next(error);
        }
    }
);



export default router;

