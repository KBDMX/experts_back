import { UUID } from "crypto";

export type Finca = {
    id_usuario: UUID;
}

export type FincaAtrubutosCreacion = Omit<Finca, 'id_usuario'>;