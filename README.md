# 🔌 Stripe Connector - Gestión de Transacciones Fallidas

Una aplicación completa para gestionar y reintentar pagos fallidos de Stripe con sistema de autenticación.

## ✨ Características

- 🔐 Sistema de autenticación (Login/Registro)
- 📊 Visualización de transacciones fallidas de Stripe
- 🔄 Reintento automático de pagos con múltiples métodos de pago
- 🌍 Información de clientes por país
- 🛡️ API segura con JWT
- 📱 Interfaz responsive

## 🏗️ Arquitectura

- **Frontend**: React + React Router
- **Backend**: Node.js + Express
- **Base de Datos**: MongoDB
- **Autenticación**: JWT (JSON Web Tokens)
- **API de Pagos**: Stripe

## 🚀 Inicio Rápido

### 1. Clonar e Instalar

```bash
# Instalar dependencias del frontend
npm install

# Instalar dependencias del backend
cd backend
npm install
cd ..
```

### 2. Configurar Variables de Entorno

**Backend** (`backend/.env`):
```bash
cd backend
cp .env.example .env
# Edita .env con tus valores:
# - MONGODB_URI (de MongoDB Atlas)
# - JWT_SECRET (una clave secreta aleatoria)
# - STRIPE_SECRET_KEY (tu clave de Stripe)
```

**Frontend** (`.env` en la raíz):
```bash
cp .env.example .env
# Por defecto usa http://localhost:5000/api
```

### 3. Crear Base de Datos

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea una cuenta gratuita
3. Crea un cluster
4. Crea un usuario de base de datos
5. Permite acceso desde cualquier IP (0.0.0.0/0)
6. Copia la URL de conexión a `backend/.env`

### 4. Iniciar la Aplicación

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Servidor corriendo en http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
npm start
# App corriendo en http://localhost:3000
```

### 5. Usar la Aplicación

1. Abre http://localhost:3000
2. Haz clic en "Regístrate"
3. Crea tu cuenta
4. Inicia sesión
5. Selecciona fechas y busca transacciones fallidas
6. Reintenta pagos

## 📁 Estructura del Proyecto

```
stripe_connector/
├── backend/               # Servidor Node.js
│   ├── models/           # Modelos de MongoDB
│   ├── routes/           # Rutas de la API
│   ├── middleware/       # Middleware de autenticación
│   ├── server.js         # Punto de entrada del servidor
│   └── package.json
│
├── src/                  # Frontend React
│   ├── components/       # Componentes reutilizables
│   ├── context/          # Context API (Auth)
│   ├── pages/           # Páginas (Login, Signup, Dashboard)
│   ├── services/        # Servicios de API
│   └── AppRoutes.js     # Configuración de rutas
│
├── public/
├── package.json
└── DESPLIEGUE.md        # Guía completa de despliegue
```

## 🔐 Seguridad

✅ **Implementado:**
- Contraseñas encriptadas con bcrypt
- Autenticación JWT
- Clave de Stripe segura en el backend
- Rutas protegidas
- CORS configurado

## 🌐 Desplegar en Producción

Lee la [Guía de Despliegue Completa](DESPLIEGUE.md) para instrucciones detalladas.

**Resumen rápido:**
1. Backend → Render/Railway
2. Frontend → Vercel/Netlify
3. Base de Datos → MongoDB Atlas (gratis)

## 🛠️ Tecnologías Usadas

### Backend
- Express.js
- MongoDB + Mongoose
- bcryptjs (encriptación)
- jsonwebtoken (JWT)
- Stripe SDK

### Frontend
- React 18
- React Router v6
- Context API
- Fetch API

## 📝 API Endpoints

### Autenticación
- `POST /api/auth/signup` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual

### Stripe (requiere autenticación)
- `GET /api/stripe/failed-transactions` - Obtener transacciones fallidas
- `GET /api/stripe/customer/:id` - Obtener info de cliente
- `GET /api/stripe/payment-methods/:id` - Obtener métodos de pago
- `POST /api/stripe/retry-payment` - Reintentar pago

## 🐛 Solución de Problemas

### Backend no conecta a MongoDB
```bash
# Verifica que MONGODB_URI sea correcta
# Permite acceso desde 0.0.0.0/0 en MongoDB Atlas
```

### Frontend no puede llamar al backend
```bash
# Verifica REACT_APP_API_URL en .env
# Asegúrate que el backend esté corriendo
```

### Transacciones no cargan
```bash
# Verifica STRIPE_SECRET_KEY en backend/.env
# Usa una clave válida de Stripe (sk_test_... o sk_live_...)
```

## 📄 Licencia

MIT

## 👨‍💻 Desarrollado por

Tu nombre aquí

---

**¿Necesitas ayuda?** Revisa [DESPLIEGUE.md](DESPLIEGUE.md) para la guía completa.
