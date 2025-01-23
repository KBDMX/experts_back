// src/middleware/xssProtection.ts
import { Request, Response, NextFunction } from 'express';

// Función para escapar caracteres especiales HTML
const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Función recursiva para sanitizar objetos
const sanitizeData = (data: any): any => {
  if (typeof data === 'string') {
    return escapeHtml(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data).reduce((acc: any, key) => {
      acc[key] = sanitizeData(data[key]);
      return acc;
    }, {});
  }
  return data;
};

// Middleware de protección XSS
export const xssProtection = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
      req.body = sanitizeData(req.body);
    }
    if (req.query) {
      req.query = sanitizeData(req.query);
    }
    if (req.params) {
      req.params = sanitizeData(req.params);
    }
    next();
  };
};

// Uso en app.ts:
/*
import express from 'express';
import { xssProtection } from './middleware/xssProtection';

const app = express();
app.use(express.json());
app.use(xssProtection());
*/