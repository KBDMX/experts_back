// auth.service.ts

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { TwoFactorAuthService } from '@services/usuarios/twoAuthFact.servicio';
import Admins from '@models/usuarios/admins.model';
import Usuarios from "@models/usuarios/usuario.model";
import { Usuario, UsuarioAtributosCreacion } from "@typesApp/usuarios/usuario.type";
import { SECRET_KEY, BY_SALT, SECRET_REFRESH_KEY } from "@db/config";
import { sendAuthCode } from '@services/usuarios/correo.servicio';
import { UUID } from 'crypto';

// Mapa de roles y sus tablas correspondientes
const roleTableMap: { [key: string]: any } = {
    admin: Admins,
    // Agrega otros roles y sus tablas aquí
    // ejemplo: "editor": Editors,
    // "manager": Managers,
};

// Instancia del servicio 2FA
const twoFactorService = new TwoFactorAuthService();

// Clave secreta específica para tokens temporales 2FA
const TEMP_TOKEN_SECRET = process.env.TEMP_TOKEN_SECRET || 'your-temp-token-secret';

// Interfaces
interface TempTokenPayload {
    id_usuario: UUID;
    expiresAt: Date;
}

// Funciones de verificación de roles
export async function isUserInRole(userId: UUID, role: string): Promise<boolean> {
    const roleTable = roleTableMap[role];
    if (!roleTable) {
        throw new Error(`El rol ${role} no está definido en el mapa de roles`);
    }

    const user = await roleTable.findOne({
        where: { id_usuario: userId },
    });

    return user !== null;
}

export async function getUserRole(userId: UUID): Promise<string | null> {
    for (const role of Object.keys(roleTableMap)) {
        const isInRole = await isUserInRole(userId, role);
        if (isInRole) {
            return role;
        }
    }
    return null;
}

// Inicio del proceso de autenticación y generación de código 2FA
export async function initiate2FA(
    usuario: string,
    pass: string,
    ipAddress: string
): Promise<{
    tempToken: string;
    expiresAt: Date;
}> {
    // Validar credenciales
    const user = await validateCredentials(usuario, pass);
    
    // Generar código 2FA
    const twoFactorResponse = await twoFactorService.generateTwoFactorCode(user.id_usuario.toString());
    
    // Enviar código por correo
    if (user.email) {
        await sendAuthCode(user.email, twoFactorResponse.code);
    } else {
        throw new Error('El usuario no tiene un correo electrónico válido');
    }

    // Generar token temporal para la verificación 2FA
    const tempToken = jwt.sign(
        {
            id_usuario: user.id_usuario,
            expiresAt: twoFactorResponse.expiresAt
        } as TempTokenPayload,
        TEMP_TOKEN_SECRET,
        { expiresIn: '10m' } // El token temporal expira en 10 minutos
    );

    return {
        tempToken,
        expiresAt: twoFactorResponse.expiresAt
    };
}

// Verificación del código 2FA
export async function verify2FA(
    code: string,
    tempToken: string,
    mantenerSesion: boolean,
    ipAddress: string
): Promise<{
    isValid: boolean;
    shouldRetry: boolean;
    remainingAttempts: number;
    message: string;
    tokens?: {
        accessToken: string;
        refreshToken: string;
    };
}> {
    console.log('Iniciando verificación 2FA:', {
        tempToken: `${tempToken.substring(0, 10)}...`,
        mantenerSesion,
        ipAddress
    });

    try {
        // Validar token temporal
        console.log('Decodificando token temporal...');
        const decoded = jwt.verify(tempToken, TEMP_TOKEN_SECRET) as TempTokenPayload;
        const userId = decoded.id_usuario;
        console.log('Token temporal decodificado exitosamente. Usuario ID:', userId);

        // Verificar código 2FA
        console.log('Verificando código 2FA para usuario:', userId);
        const verificationResult = await twoFactorService.verifyTwoFactorCode(
            userId.toString(),
            code,
            ipAddress
        );
        console.log('Resultado de verificación 2FA:', {
            isValid: verificationResult.isValid,
            shouldRetry: verificationResult.shouldRetry,
            remainingAttempts: verificationResult.remainingAttempts
        });

        if (verificationResult.isValid) {
            // Obtener rol del usuario y generar tokens finales
            console.log('Código 2FA válido. Obteniendo rol del usuario...');
            const userRole = await getUserRole(userId);
            
            if (!userRole) {
                console.error('Error: Usuario sin rol asignado. ID:', userId);
                throw new Error('El usuario no tiene un rol asignado');
            }
            
            console.log('Generando tokens de autenticación para usuario:', {
                userId,
                role: userRole,
                mantenerSesion
            });
            
            const tokens = await generateAuthTokens(userId, userRole, mantenerSesion);
            console.log('Tokens generados exitosamente');
            
            return {
                ...verificationResult,
                tokens
            };
        }

        console.log('Código 2FA inválido. Retornando resultado de verificación');
        return verificationResult;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            console.error('Error: Token temporal expirado');
            throw new Error('El token temporal ha expirado');
        }
        console.error('Error inesperado durante la verificación 2FA:', error);
        throw error;
    }
}

// Funciones auxiliares
async function validateCredentials(usuario: string, pass: string): Promise<Usuario> {
    const user = await getUserByEmailOrUsername(usuario);
    if (!user) {
        throw new Error('Credenciales inválidas');
    }

    const isPasswordCorrect = await bcrypt.compare(pass, user.pass);
    if (!isPasswordCorrect) {
        throw new Error('Credenciales inválidas');
    }

    return user;
}

async function generateAuthTokens(
    userId: UUID,
    userRole: string,
    mantenerSesion: boolean
): Promise<{
    accessToken: string;
    refreshToken: string;
}> {
    if (!SECRET_KEY || !SECRET_REFRESH_KEY) {
        throw new Error('Claves secretas no configuradas');
    }

    const accessTokenExpiresIn = '15m';
    const refreshTokenExpiresIn = mantenerSesion ? '7d' : '1h';

    const accessToken = jwt.sign(
        {
            id_usuario: userId,
            rol: userRole
        },
        SECRET_KEY,
        { expiresIn: accessTokenExpiresIn }
    );

    const refreshToken = jwt.sign(
        {
            id_usuario: userId
        },
        SECRET_REFRESH_KEY,
        { expiresIn: refreshTokenExpiresIn }
    );

    return { accessToken, refreshToken };
}

// Registro de nuevos usuarios
export async function register(usuario: UsuarioAtributosCreacion): Promise<UsuarioAtributosCreacion> {
    const userExists = await getUserByEmailOrUsername(usuario.email || '');
    if (userExists) {
        throw new Error('El usuario ya existe');
    }

    const { email, usuario: username, pass } = usuario;

    if (!email || !username || !pass) {
        throw new Error('Faltan datos requeridos');
    }

    // Validaciones de contraseña
    if (pass.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const passwordRegex = {
        mayuscula: /[A-Z]/,
        minuscula: /[a-z]/,
        numero: /[0-9]/,
        especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
    };

    if (!passwordRegex.mayuscula.test(pass)) {
        throw new Error('La contraseña debe contener al menos una letra mayúscula');
    }

    if (!passwordRegex.minuscula.test(pass)) {
        throw new Error('La contraseña debe contener al menos una letra minúscula');
    }

    if (!passwordRegex.numero.test(pass)) {
        throw new Error('La contraseña debe contener al menos un número');
    }

    if (!passwordRegex.especial.test(pass)) {
        throw new Error('La contraseña debe contener al menos un carácter especial');
    }

    if (username.length < 6 || username.length > 20) {
        throw new Error('El usuario debe tener entre 6 y 20 caracteres');
    }

    if (username.includes(' ')) {
        throw new Error('El usuario no puede contener espacios');
    }

    if (!isEmail(email)) {
        throw new Error('El email no es válido');
    }

    const hashedPass = await bcrypt.hash(pass, Number(BY_SALT));
    usuario.pass = hashedPass;

    try {
        const user = await Usuarios.create({
            email: usuario.email,
            usuario: usuario.usuario,
            pass: usuario.pass
        });
        return user.toJSON();
    } catch (error) {
        throw new Error('Error al crear el usuario');
    }
}

// Verificación de tokens
export async function verifyToken(token: string): Promise<{ valid: boolean }> {
    if (!SECRET_KEY) {
        throw new Error('Clave secreta no configurada');
    }

    try {
        jwt.verify(token, SECRET_KEY);
        return { valid: true };
    } catch (error) {
        throw new Error('Token inválido');
    }
}

// Refrescar token
export async function refreshToken(token: string): Promise<{ token: string }> {
    if (!SECRET_REFRESH_KEY || !SECRET_KEY) {
        throw new Error('Claves secretas no configuradas');
    }

    const payload = jwt.verify(token, SECRET_REFRESH_KEY) as { id_usuario: UUID };

    const userRole = await getUserRole(payload.id_usuario);
    if (!userRole) {
        throw new Error('El usuario no tiene un rol asignado');
    }

    const newAccessToken = jwt.sign(
        {
            id_usuario: payload.id_usuario,
            rol: userRole
        },
        SECRET_KEY,
        { expiresIn: '15m' }
    );

    return { token: newAccessToken };
}

// Funciones de utilidad
async function getUserByEmailOrUsername(identifier: string): Promise<Usuario | null> {
    if (isEmail(identifier)) {
        return await Usuarios.findOne({ where: { email: identifier } }) as Usuario | null;
    } else {
        return await Usuarios.findOne({ where: { usuario: identifier } }) as Usuario | null;
    }
}

function isEmail(identifier: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(identifier);
}

export default {
    initiate2FA,
    verify2FA,
    register,
    verifyToken,
    refreshToken,
    isUserInRole,
    getUserRole
};
