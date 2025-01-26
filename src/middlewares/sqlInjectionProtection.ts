// src/middleware/sqlInjectionProtection.ts
import { Request, Response, NextFunction } from 'express';

const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,          // Comillas simples y comentarios
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i, // Inyecciones básicas
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i, // Patrones 'OR'
  /((\%27)|(\'))union/i,                      // UNION queries
  /exec(\s|\+)+(s|x)p\w+/i,                   // Ejecución de stored procedures
  /INFORMATION_SCHEMA|SCHEMATA|SCHEMA_NAME/i   // Intentos de obtener metadata
];

const sanitizeSqlInput = (value: string): string => {
  // Remueve caracteres peligrosos y escapa comillas
  return value
    .replace(/['";]/g, '')  // Remueve comillas y punto y coma
    .replace(/--/g, '')     // Remueve comentarios SQL
    .replace(/\/\*/g, '')   // Remueve comentarios multilínea
    .replace(/\*\//g, '')   // Remueve cierre de comentarios multilínea
    .replace(/union/gi, '') // Remueve UNION
    .replace(/select/gi, '') // Remueve SELECT
    .replace(/drop/gi, '')   // Remueve DROP
    .replace(/delete/gi, '') // Remueve DELETE
    .trim();
};

const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeSqlInput(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};

const detectSqlInjection = (value: string): boolean => {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
};

export const sqlInjectionProtection = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Revisa body, query y params por patrones maliciosos
      const checkPart = (obj: any): boolean => {
        if (typeof obj === 'string') {
          return detectSqlInjection(obj);
        }
        if (typeof obj === 'object' && obj !== null) {
          return Object.values(obj).some(value => checkPart(value));
        }
        return false;
      };

      if (checkPart(req.body) || checkPart(req.query) || checkPart(req.params)) {
        res.status(403).json({
          error: 'Posible intento de SQL Injection detectado'
        });
      }

      // Sanitiza los inputs
      if (req.body) req.body = sanitizeObject(req.body);
      if (req.query) req.query = sanitizeObject(req.query);
      if (req.params) req.params = sanitizeObject(req.params);

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Uso:
/*
import express from 'express';
import { sqlInjectionProtection } from './middleware/sqlInjectionProtection';

const app = express();
app.use(express.json());
app.use(sqlInjectionProtection());
*/