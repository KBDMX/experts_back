import { Redis } from 'ioredis';
import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from "@db/config";
import { Usuario } from "@typesApp/usuarios/usuario.type";

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

    async verifyTwoFactorCode(userId: string, inputCode: string): Promise<boolean> {
        const keys = this.getRedisKeys(userId);

        const isBlocked = await this.redis.exists(keys.blocked);
        if (isBlocked) {
            const ttl = await this.redis.ttl(keys.blocked);
            throw new Error(`Usuario bloqueado. Intente nuevamente en ${Math.ceil(ttl / 60)} minutos`);
        }

        const [storedCode, remainingAttemptsStr] = await Promise.all([
            this.redis.get(keys.code),
            this.redis.get(keys.attempts)
        ]);

        if (!storedCode || !remainingAttemptsStr) {
            throw new Error('Código expirado o inválido');
        }

        const remainingAttempts = parseInt(remainingAttemptsStr) - 1;

        if (inputCode !== storedCode) {
            if (remainingAttempts <= 0) {
                await this.redis.set(keys.blocked, '1', 'EX', this.BLOCK_TIME);
                await Promise.all([
                    this.redis.del(keys.code),
                    this.redis.del(keys.attempts)
                ]);
                throw new Error(`Máximo de intentos excedido. Usuario bloqueado por ${this.BLOCK_TIME / 60} minutos`);
            }

            await this.redis.set(keys.attempts, remainingAttempts, 'EX', this.CODE_TTL);
            throw new Error(`Código incorrecto. Intentos restantes: ${remainingAttempts}`);
        }

        await Promise.all([
            this.redis.del(keys.code),
            this.redis.del(keys.attempts)
        ]);

        return true;
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