# Documentación del proyecto de Software seguro

## Índice
- [Clonar y ejecutar el proyecto](#clonar-y-ejecutar-el-proyecto)
  - [Guía para Correr el Proyecto Backend](#guía-para-correr-el-proyecto-backend)
  - [Guía para Correr el Proyecto Frontend](#guía-para-correr-el-proyecto-frontend)
- [Aspectos de seguridad del proyecto](#aspectos-de-seguridad-del-proyecto)
  - [Autorización](#autorización)
  - [Confidencialidad](#confidencialidad)
  - [Integridad](#integridad)
  - [Principios de Seguridad](#principios-de-seguridad)

## Clonar y ejecutar el proyecto

### Guía para Correr el Proyecto Backend

Este documento describe los pasos necesarios para correr un proyecto backend desarrollado en Node.js, con PostgreSQL y Redis en contenedores Docker.

#### Prerrequisitos

Antes de ejecutar el proyecto, asegúrate de tener instalados:
* Node.js y npm
* Docker y Docker Compose
* PostgreSQL Client (opcional, para inspeccionar la base de datos)

#### Pasos para Ejecutar el Backend

1. **Clonar el Repositorio**

```bash
git clone https://AppWebAvanzadas2024BKennyPinchao@dev.azure.com/AppWebAvanzadas2024BKennyPinchao/ExpertGuide/_git/ExpertGuide%20-%20Back
cd experts-back
```

2. **Configurar Variables de Entorno**

Crea un archivo `.env` en la raíz del proyecto y copia el siguiente contenido ajustando los valores según sea necesario:

```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=3320
DB_USER=root
DB_PASSWORD=123456
DB_NAME=experts_db
PORT=3001
HOST=localhost
PROTOCOL=http
SECRET_KEY="EXPERTSpIn180473@3"
BY_SALT=10
SECRET_REFRESH_KEY="EXPERTSpIn180473@3"
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=X4m4Br1Knyt3fF0
NODE_ENV=development
```

3. **Construir y Levantar los Contenedores**

```bash
docker-compose up -d
```

4. **Inicializar la Base de Datos**

```bash
npm run init-db
```

5. **Instalar Dependencias**

```bash
npm install
```

6. **Ejecutar el Proyecto en Modo Desarrollo**

```bash
npm run dev
```

7. **Compilar y Ejecutar en Producción**

```bash
npm run build
npm start
```

8. **Verificar Conexión a la Base de Datos y Redis**

```bash
psql -h localhost -p 3320 -U root -d experts_db
redis-cli -h localhost -p 6379 -a X4m4Br1Knyt3fF0
```

### Guía para Correr el Proyecto Frontend

Este documento describe los pasos necesarios para correr un proyecto frontend desarrollado con Next.js.

#### Prerrequisitos

* Node.js (versión recomendada: 18.20.2 o superior)
* npm o yarn

#### Pasos para Ejecutar el Frontend

1. **Clonar el Repositorio**

```bash
git clone https://AppWebAvanzadas2024BKennyPinchao@dev.azure.com/AppWebAvanzadas2024BKennyPinchao/ExpertGuide/_git/ExpertGuide%20-%20Front
cd experts-front
```

2. **Configurar Variables de Entorno**

Crea un archivo `.env.local` en la raíz del proyecto:

```env
BASE_URL="http://localhost:3001/api/v1"
```

3. **Instalar Dependencias**

```bash
npm install
```

4. **Ejecutar el Proyecto en Modo Desarrollo**

```bash
npm run dev
```

Esto levantará el frontend en `http://localhost:3000`.

5. **Compilar y Ejecutar en Producción**

```bash
npm run build
npm start
```

## Aspectos de seguridad del proyecto

### Autorización

Se implementó la autorización para los usuarios según su rol, solo los usuarios autorizados pueden acceder a las rutas respectivas según su rol, es uno de los filtros que deben pasar antes de poder realizar alguna acción.

El middleware implementado es el siguiente: `authorize.ts`

#### Flujo de trabajo completo:
* Asegúrate de que el JWT middleware configure `req.auth`
* Obtiene el ID del usuario desde req.auth
* Con el Id del usuario se obtiene el rol desde la base de datos
* Verificar si el rol está permitido y le da autorización según su rol

#### Herramienta utilizada:
* El middleware está diseñado para ser utilizado en una aplicación basada en Express
* Las funciones como req, res, y next son proporcionadas por Express
* JWT (JSON Web Token): El código asume que el objeto req.auth contiene información sobre el usuario autenticado
* Uso: La librería jsonwebtoken verifica y decodifica el token JWT para asignar la información del usuario autenticado a req.auth

![cambio de roles](https://dev.azure.com/AppWebAvanzadas2024BKennyPinchao/2602ff21-7545-4e59-8f6b-f582f33d7786/_apis/git/repositories/e9d2b90b-e783-4222-844e-daa3909e73a7/items?path=/Img/Pantalla%20de%20cambio%20de%20roles.png&versionDescriptor%5BversionOptions%5D=0&versionDescriptor%5BversionType%5D=0&versionDescriptor%5Bversion%5D=main&resolveLfs=true&%24format=octetStream&api-version=5.0)

### Confidencialidad

#### 1. Uso de contraseñas seguras

Se garantiza que la información solo sea accesible a las personas autorizadas. Una contraseña fuerte reduce la posibilidad de que un atacante acceda de manera no autorizada a los datos protegidos.

Dentro de la carpeta register se encuentra el archivo page.tsx, donde se implementa una validación para garantizar que el usuario establezca una contraseña segura. Esta validación asegura que la contraseña cumpla con los siguientes requisitos: al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.

![contraseña segura](url-de-la-imagen)

#### 2. Autenticación: Cifrado de contraseñas y 2FA

Tras el registro del usuario en la aplicación la contraseña del usuario es encriptada usando la librería bcrypt. Luego para el ingreso del usuario en la aplicación el usuario tiene que ingresar su contraseña, pero además se le solicita un código de verificación adicional que llega a su correo electrónico.

![codigo de la autenticación](url-de-la-imagen)

La autenticación de dos factores se implementó de la siguiente manera:
1. Redis: Se utilizó esta dependencia que simulará una base de datos en memoria para almacenar este token de segunda autenticación
2. Crypto: Encargada de generar un código aleatorio de tipo entero
3. Nodemailer: Esta dependencia permite enviar al correo electrónico del usuario un mensaje con su código de doble autenticación cuya validez es de 10 minutos

### Integridad

En la carpeta documentos se implementa el servicio de integridad para los documentos base del sistema, utilizando un proceso de hasheo de archivos. Este servicio cuenta con las siguientes funcionalidades:

1. **Generación de Hash**: La función generarDocumentoHash se encarga de generar un hash único para cada documento, asegurando su integridad.

2. **Verificación de Integridad**: Antes de realizar cualquier actualización, la función verificarIntegridadDocumento comprueba si el hash actual del documento coincide con el almacenado previamente.

3. **Actualización y Regeneración del Hash**: Cuando se requiere actualizar un documento, se utiliza la función updateDocumentoBase, que actualiza el contenido del documento y genera un nuevo hash.

![hasheo de archivos](url-de-la-imagen)

### Validación de datos de entrada

#### Prevención de ataques XSS
Dentro de la carpeta Middleware se agrega un archivo de nombre xssProtection.ts. Este archivo contiene una clase o función que se encarga de escapar caracteres especiales de HTML y sanitizar las entradas para proteger contra ataques XSS.

Para probar esta funcionalidad se puede probar en cualquier entrada lo siguiente:
```html
<script>alert('XSS')</script>
```

#### Prevención de ataques SQLInjection
Se implementó un archivo sqlInjectionProtection.ts que contiene una función para escapar los caracteres que se usan en las consultas SQL y otros caracteres especiales.

### Principios de Seguridad

El sistema implementa los siguientes principios fundamentales:

#### 1. Principio de Trazabilidad (Accountability)
- Registro de eventos de autenticación y acciones críticas
- Captura de IP, User-Agent y método HTTP en cada log
- Decodificación del JWT para identificar al usuario

#### 2. Principio de Integridad (Integrity)
- Protección de logs con hashing SHA-256
- Hash único para cada registro

#### 3. Principio de No Repudio (Non-Repudiation)
- Registro detallado de login/logout
- Almacenamiento de id_usuario, IP y User-Agent
- JWT con firma digital

#### 4. Principio de Monitoreo y Detección (Auditability)
- Uso de Morgan para captura HTTP
- Registro de eventos inusuales
- Monitoreo de intentos fallidos

#### 5. Principio de Minimización de Impacto
- Separación de base de datos de logs
- Registro de eventos críticos con trazabilidad completa

## Conclusión

El sistema de auditoría implementado cumple con múltiples principios de seguridad esenciales. Gracias a la trazabilidad, integridad y monitoreo, se garantiza la seguridad de la información y la detección de anomalías en la aplicación. Para mejorar aún más la seguridad, se pueden considerar medidas adicionales como detección de intentos de acceso sospechosos mediante rate limiting y alertas de seguridad en tiempo real.
