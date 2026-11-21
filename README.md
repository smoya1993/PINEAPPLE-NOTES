# 🍍 Pineapple Notes Enterprise (Full-Stack + PostgreSQL)

Sistema de gestión de notas jerárquicas, tareas y seguimiento de reuniones con arquitectura **Client / Server + JWT + PostgreSQL** (siguiendo la estructura de `Recipen`).

## Arquitectura del Proyecto

```text
PINEAPPLE NOTES/
├── client/                 # Frontend (Vite + Nginx en Docker)
│   ├── index.html
│   ├── nginx.conf          # Sirve SPA y hace proxy de /api/ al backend
│   ├── Dockerfile
│   └── src/
│       ├── styles/
│       └── js/
│           ├── services/   # apiService.js, authService.js, fsService.js (PostgreSQL)
│           └── components/ # authView.js, editor.js, sidebar.js, toolbar.js, ...
├── server/                 # Backend REST API (Node.js + Express + pg + JWT)
│   ├── index.js
│   ├── Dockerfile
│   ├── env.postgres.example
│   ├── config/             # CORS y orígenes permitidos
│   ├── db/                 # pool.js (JDBC / DATABASE_URL), conn.js, schema.js, schema.sql
│   ├── middleware/         # verifyJwt.js, credentials.js, loginLimit.js, errorHandler.js
│   ├── controllers/        # auth, workspace, note, task, meeting, image
│   ├── routes/             # /api/auth, /api/workspace, /api/notes, /api/tasks, /api/meetings, /api/images
│   └── scripts/
│       └── importJson.js   # Migración CLI de datos.json a PostgreSQL
└── docker-compose.yml      # Contenedores pineapple-front y pineapple-back (red cicd)
```

## Modelo de Base de Datos (PostgreSQL)

El esquema se crea automáticamente de forma idempotente al arrancar el backend (`server/db/schema.js`) y también está disponible en `server/db/schema.sql`:

- `users`: cuentas de usuario con contraseña hasheada (`bcrypt`) y `refresh_token` JWT.
- `pages`: notas jerárquicas (`id`, `user_id`, `title`, `icon`, `parent_id`, `sort_order`, `content`, `is_favorite`, `created_at`, `updated_at`).
- `task_items`: gestor de tareas por usuario.
- `meeting_items`: puntos a comentar en reuniones por usuario.
- `images`: imágenes subidas desde el editor almacenadas en PostgreSQL (`bytea`) y servidas en `/api/images/:id`.

## Arranque en Desarrollo Local

### 1. Configurar variables de entorno del backend
Copia `server/env.postgres.example` a `server/.env` y rellena tus credenciales de PostgreSQL y secretos JWT:

```env
PORT=8085
NODE_ENV=development
POSTGRES_URI=jdbc:postgresql://TU_HOST:5432/pineapple_notes
POSTGRES_USER=postgres
POSTGRES_PASSWORD=tu_password
ACCESS_TOKEN_SECRET=un_secreto_largo_y_aleatorio
REFRESH_TOKEN_SECRET=otro_secreto_largo_y_aleatorio
ALLOWED_ORIGINS=http://localhost:5173
```

*(También puedes usar `DATABASE_URL=postgresql://usuario:password@host:5432/pineapple_notes` en lugar de `POSTGRES_URI`.)*

### 2. Instalar dependencias y arrancar

```bash
npm run install:all
npm run dev:server
npm run dev:client
```

- Frontend: `http://localhost:5173` (con proxy automático de `/api` hacia `http://localhost:8085`)
- Backend: `http://localhost:8085/api/health`

## Importar tu `datos.json` actual

Tienes dos formas:
1. **Desde la interfaz web**: inicia sesión y pulsa **📥 Importar JSON** en la barra lateral izquierda para subir tu `datos.json`.
2. **Por línea de comandos**:
   ```bash
   node server/scripts/importJson.js tu@email.com datos.json
   ```

## Despliegue con Docker Compose

```bash
docker compose up -d --build
```
