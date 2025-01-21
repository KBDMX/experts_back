import { UUID } from "crypto";

export type Admin = {
    id_usuario: UUID;
}

export type AdminAtributosCreacion = Omit<Admin, 'id_usuario'>;