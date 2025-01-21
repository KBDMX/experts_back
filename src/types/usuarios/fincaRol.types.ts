import { UUID } from "crypto";

export type Finca = {
    id_usuario: UUID;
}

export type FincaAtributosCreacion = Omit<Finca, 'id_usuario'>;