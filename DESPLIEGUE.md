# 🚀 Guía de Despliegue - Stripe Connector

Esta guía te ayudará a desplegar tu aplicación en producción paso a paso.

## 📋 Requisitos Previos

1. Cuenta en MongoDB Atlas (gratis): https://www.mongodb.com/cloud/atlas
2. Cuenta en Render o Railway (gratis): https://render.com o https://railway.app
3. Cuenta en Vercel o Netlify (gratis): https://vercel.com o https://netlify.com
4. Tu clave secreta de Stripe

---

## 🗄️ Paso 1: Configurar Base de Datos (MongoDB Atlas)

1. Ve a https://www.mongodb.com/cloud/atlas
2. Crea una cuenta gratis
3. Crea un nuevo proyecto
4. Crea un cluster gratuito (M0)
5. En "Database Access", crea un usuario con contraseña
6. En "Network Access", permite acceso desde cualquier IP (0.0.0.0/0)
7. Haz clic en "Connect" → "Connect your application"
8. Copia la URL de conexión (se ve así):
   ```
   mongodb+srv://usuario:password@cluster.mongodb.net/stripe_connector?retryWrites=true&w=majority
   ```
9. **Guarda esta URL**, la necesitarás más adelante

---

## 🖥️ Paso 2: Desplegar el Backend

### Opción A: Usar Render (Recomendado)

1. Ve a https://render.com y crea una cuenta
2. Haz clic en "New" → "Web Service"
3. Conecta tu repositorio de GitHub (o sube el código)
4. Configuración:
   - **Name**: stripe-connector-backend
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. En "Environment Variables", agrega:
   ```
   MONGODB_URI = (pega tu URL de MongoDB Atlas del Paso 1)
   JWT_SECRET = una-clave-super-secreta-aleatoria-123456
   STRIPE_SECRET_KEY = sk_test_tu_clave_de_stripe
   PORT = 5000
   NODE_ENV = production
   ```

6. Haz clic en "Create Web Service"
7. **Guarda la URL** que te dan (ejemplo: `https://stripe-connector-backend.onrender.com`)

### Opción B: Usar Railway

1. Ve a https://railway.app y crea una cuenta
2. Haz clic en "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio
4. En Settings:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start`
5. En Variables, agrega las mismas que en Render (arriba)
6. **Guarda la URL** del servicio

---

## 🌐 Paso 3: Desplegar el Frontend

### Opción A: Usar Vercel (Recomendado)

1. Ve a https://vercel.com y crea una cuenta
2. Haz clic en "Add New" → "Project"
3. Importa tu repositorio de GitHub
4. Configuración:
   - **Framework Preset**: Create React App
   - **Root Directory**: `./` (raíz del proyecto)

5. En "Environment Variables", agrega:
   ```
   REACT_APP_API_URL = https://tu-backend-url.onrender.com/api
   ```
   (Usa la URL del backend del Paso 2)

6. Haz clic en "Deploy"
7. ¡Listo! Tu app estará en una URL como `https://stripe-connector.vercel.app`

### Opción B: Usar Netlify

1. Ve a https://netlify.com y crea una cuenta
2. Arrastra la carpeta de tu proyecto o conecta GitHub
3. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `build`
4. En "Environment Variables", agrega `REACT_APP_API_URL` con la URL del backend
5. Deploy

---

## ⚙️ Paso 4: Configurar Variables de Entorno Localmente

### Backend
1. Ve a la carpeta `backend/`
2. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` y pon tus valores reales

### Frontend
1. En la raíz del proyecto, copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edita `.env`:
   ```
   REACT_APP_API_URL=http://localhost:5000/api
   ```

---

## 🧪 Paso 5: Probar Localmente

### 1. Instalar dependencias

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ..
npm install
```

### 2. Iniciar servidores

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm start
```

3. Abre http://localhost:3000
4. Regístrate con un email y contraseña
5. Inicia sesión
6. Prueba cargar transacciones fallidas

---

## 🔐 Seguridad

✅ **LO QUE HICIMOS PARA PROTEGER TU APP:**
- La clave secreta de Stripe está en el backend (no visible en el navegador)
- Sistema de autenticación con JWT
- Solo usuarios autenticados pueden acceder
- Las contraseñas se guardan encriptadas

⚠️ **IMPORTANTE:**
- Nunca subas archivos `.env` a GitHub
- Usa contraseñas seguras para MongoDB
- Guarda tus claves en un lugar seguro

---

## 📝 Comandos Útiles

```bash
# Backend
cd backend
npm install          # Instalar dependencias
npm start           # Iniciar servidor
npm run dev         # Iniciar con nodemon (auto-reload)

# Frontend
npm install         # Instalar dependencias
npm start          # Iniciar app en desarrollo
npm run build      # Crear versión de producción
```

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to MongoDB"
- Verifica que la URL de MongoDB sea correcta
- Asegúrate de haber permitido acceso desde cualquier IP en MongoDB Atlas

### Error: "CORS error" o "Network error"
- Verifica que `REACT_APP_API_URL` apunte a la URL correcta del backend
- Asegúrate de incluir `/api` al final

### El login no funciona
- Verifica que el backend esté corriendo
- Revisa la consola del navegador para ver errores
- Asegúrate de que `JWT_SECRET` esté configurado en el backend

### Transacciones no cargan
- Verifica que tu `STRIPE_SECRET_KEY` sea correcta
- Asegúrate de estar usando una clave válida de Stripe

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs del backend en Render/Railway
2. Revisa la consola del navegador (F12)
3. Verifica que todas las variables de entorno estén configuradas

---

## 🎉 ¡Felicidades!

Tu aplicación ya está desplegada y lista para usar. Ahora otros usuarios pueden:
1. Registrarse con su email
2. Iniciar sesión
3. Ver y gestionar transacciones fallidas de Stripe

**URLs importantes:**
- Frontend: https://tu-app.vercel.app
- Backend: https://tu-backend.onrender.com
- Base de datos: MongoDB Atlas
