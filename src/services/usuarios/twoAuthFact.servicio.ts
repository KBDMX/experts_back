//twoAuthFact.servicio.ts

import { Redis } from 'ioredis';
import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from "@db/config";
import { Usuario } from "@typesApp/usuarios/usuario.type";


interface AuditLog {
    userId: string;
    timestamp: Date;
    ipAddress: string;
    attemptStatus: 'failed' | 'blocked';
    remainingAttempts: number;
}

function logFailedAttempt(auditData: AuditLog) {
    console.log('=== Failed 2FA Attempt Audit Log ===');
    console.log(`User ID: ${auditData.userId}`);
    console.log(`Timestamp: ${auditData.timestamp.toISOString()}`);
    console.log(`IP Address: ${auditData.ipAddress}`);
    console.log(`Status: ${auditData.attemptStatus}`);
    console.log(`Remaining Attempts: ${auditData.remainingAttempts}`);
    console.log('==================================');
}


export class TwoFactorAuthService {
    private redis: Redis;
    private readonly CODE_LENGTH = 6;
    private readonly CODE_TTL = 10 * 60; // 10 minutos en segundos
    private readonly MAX_ATTEMPTS = 3;
    private readonly BLOCK_TIME = 30 * 60; // 30 minutos en segundos

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            tls: process.env.NODE_ENV === 'production' ? {} : undefined
        });

        // Manejo de eventos de Redis
        this.redis.on('error', (error) => {
            console.error('Error en Redis:', error);
        });

        this.redis.on('connect', () => {
            console.log('Conectado a Redis exitosamente');
        });
    }

    private generateCode(): string {
        const min = Math.pow(10, this.CODE_LENGTH - 1);
        const max = Math.pow(10, this.CODE_LENGTH) - 1;
        return randomInt(min, max).toString().padStart(this.CODE_LENGTH, '0');
    }

    private getRedisKeys(userId: string) {
        return {
            code: `2fa:code:${userId}`,
            attempts: `2fa:attempts:${userId}`,
            blocked: `2fa:blocked:${userId}`
        };
    }

    async generateTwoFactorCode(userId: string): Promise<{
        code: string;
        expiresAt: Date;
        remainingAttempts: number;
    }> {
        const keys = this.getRedisKeys(userId);

        const isBlocked = await this.redis.exists(keys.blocked);
        if (isBlocked) {
            const ttl = await this.redis.ttl(keys.blocked);
            throw new Error(`Usuario bloqueado. Intente nuevamente en ${Math.ceil(ttl / 60)} minutos`);
        }

        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + this.CODE_TTL * 1000);

        await Promise.all([
            this.redis.set(keys.code, code, 'EX', this.CODE_TTL),
            this.redis.set(keys.attempts, this.MAX_ATTEMPTS, 'EX', this.CODE_TTL)
        ]);

        return {
            code,
            expiresAt,
            remainingAttempts: this.MAX_ATTEMPTS
        };
    }

    async verifyTwoFactorCode(userId: string, inputCode: string, ipAddress: string): Promise<{
        isValid: boolean;
        shouldRetry: boolean;
        remainingAttempts: number;
        message: string;

    }> {
        const keys = this.getRedisKeys(userId);

        const isBlocked = await this.redis.exists(keys.blocked);
        if (isBlocked) {
            const ttl = await this.redis.ttl(keys.blocked);
            
            logFailedAttempt({
                userId,
                timestamp: new Date(),
                ipAddress,
                attemptStatus: 'blocked',
                remainingAttempts: 0
            });

            return {
                isValid: false,
                shouldRetry: false,
                remainingAttempts: 0,
                message: `Usuario bloqueado. Intente nuevamente en ${Math.ceil(ttl / 60)} minutos`
            };
        }

        const [storedCode, remainingAttemptsStr] = await Promise.all([
            this.redis.get(keys.code),
            this.redis.get(keys.attempts)
        ]);

        if (!storedCode || !remainingAttemptsStr) {
            return {
                isValid: false,
                shouldRetry: false,
                remainingAttempts: 0,
                message: 'Código expirado o inválido'
            };
        }

        const remainingAttempts = parseInt(remainingAttemptsStr) - 1;

        if (inputCode !== storedCode) {
            logFailedAttempt({
                userId,
                timestamp: new Date(),
                ipAddress,
                attemptStatus: 'failed',
                remainingAttempts
            });
            if (remainingAttempts <= 0) {
                await this.redis.set(keys.blocked, '1', 'EX', this.BLOCK_TIME);
                await Promise.all([
                    this.redis.del(keys.code),
                    this.redis.del(keys.attempts)
                ]);
                
                console.log(`Usuario ${userId} bloqueado por exceder el máximo de intentos`);
                
                return {
                    isValid: false,
                    shouldRetry: false,
                    remainingAttempts: 0,
                    message: `Máximo de intentos excedido. Usuario bloqueado por ${this.BLOCK_TIME / 60} minutos`
                };
            }

            await this.redis.set(keys.attempts, remainingAttempts, 'EX', this.CODE_TTL);
            return {
                isValid: false,
                shouldRetry: true,
                remainingAttempts,
                message: `Código incorrecto. Intentos restantes: ${remainingAttempts}`
            };
        }

        await Promise.all([
            this.redis.del(keys.code),
            this.redis.del(keys.attempts)
        ]);

        return {
            isValid: true,
            shouldRetry: false,
            remainingAttempts: 0,
            message: 'Código verificado exitosamente'
        };
    }

    async cleanup(userId: string): Promise<void> {
        const keys = this.getRedisKeys(userId);
        await Promise.all([
            this.redis.del(keys.code),
            this.redis.del(keys.attempts),
            this.redis.del(keys.blocked)
        ]);
    }
}