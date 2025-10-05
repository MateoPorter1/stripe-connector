# 🚀 Guía de Despliegue - Paso a Paso (Super Simple)

Esta guía te llevará paso a paso para tener tu aplicación funcionando en internet.

---

## 📱 PASO 1: Crear Base de Datos en MongoDB Atlas (GRATIS)

### 1.1 Crear cuenta en MongoDB Atlas
1. Ve a: https://www.mongodb.com/cloud/atlas
2. Haz clic en "Try Free" (Prueba Gratis)
3. Regístrate con tu email
4. Verifica tu email

### 1.2 Crear tu primera base de datos
1. Una vez dentro, haz clic en "Build a Database"
2. Selecciona el plan **FREE** (M0)
3. Selecciona región: **us-east-1** (o la más cercana a ti)
4. Dale un nombre a tu cluster: `stripe-connector` (o el que prefieras)
5. Haz clic en "Create"

### 1.3 Configurar acceso
1. Te pedirá crear un usuario:
   - Username: `admin` (o el que quieras)
   - Password: Crea una contraseña **segura** y **guárdala** ⚠️
   - Haz clic en "Create User"

2. Permitir acceso desde cualquier IP:
   - En "Where would you like to connect from?"
   - Haz clic en "Add Entry"
   - Pon: `0.0.0.0/0` (esto permite acceso desde cualquier lugar)
   - Haz clic en "Add Entry"
   - Haz clic en "Finish and Close"

### 1.4 Obtener URL de conexión
1. En el dashboard, haz clic en "Connect"
2. Selecciona "Connect your application"
3. Copia la URL que aparece (se ve así):
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. **IMPORTANTE**: Reemplaza `<password>` con tu contraseña real
5. Agrega al final: `/stripe_connector` (nombre de tu base de datos)
6. La URL final debe verse así:
   ```
   mongodb+srv://admin:tuPassword123@cluster0.xxxxx.mongodb.net/stripe_connector?retryWrites=true&w=majority
   ```
7. **GUARDA ESTA URL** - la necesitarás después ⚠️

---

## 🖥️ PASO 2: Desplegar Backend en Render (GRATIS)

### 2.1 Subir código a GitHub (si no lo has hecho)
1. Ve a https://github.com
2. Crea un repositorio nuevo llamado `stripe-connector`
3. Sube tu código (si no sabes cómo, puedo ayudarte)

### 2.2 Crear cuenta en Render
1. Ve a: https://render.com
2. Haz clic en "Get Started for Free"
3. Regístrate con tu cuenta de GitHub

### 2.3 Crear Web Service
1. En Render, haz clic en "New" → "Web Service"
2. Conecta tu repositorio de GitHub: `stripe-connector`
3. Dale un nombre: `stripe-connector-backend`
4. Configuración:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Selecciona **FREE**

### 2.4 Agregar Variables de Entorno
En la sección "Environment Variables", agrega estas 5 variables:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | (Pega aquí la URL de MongoDB del Paso 1.4) |
| `JWT_SECRET` | `mi-super-secreto-123456-cambiar` (inventa uno único) |
| `STRIPE_SECRET_KEY` | (Tu clave de Stripe, empieza con `sk_test_...`) |
| `PORT` | `5000` |
| `NODE_ENV` | `production` |

### 2.5 Desplegar
1. Haz clic en "Create Web Service"
2. Espera 2-3 minutos mientras despliega
3. Cuando diga "Live" (en verde), ¡está listo! 🎉
4. **COPIA LA URL** que aparece arriba (ejemplo: `https://stripe-connector-backend.onrender.com`)
5. **GUÁRDALA** - la necesitarás en el siguiente paso ⚠️

---

## 🌐 PASO 3: Desplegar Frontend en Vercel (GRATIS)

### 3.1 Crear cuenta en Vercel
1. Ve a: https://vercel.com
2. Haz clic en "Sign Up"
3. Regístrate con tu cuenta de GitHub

### 3.2 Importar Proyecto
1. En Vercel, haz clic en "Add New" → "Project"
2. Busca y selecciona tu repositorio: `stripe-connector`
3. Haz clic en "Import"

### 3.3 Configurar Proyecto
1. **Framework Preset**: Selecciona `Create React App`
2. **Root Directory**: Déjalo en `./` (raíz)
3. En "Environment Variables", agrega:

| Name | Value |
|------|-------|
| `REACT_APP_API_URL` | (Pega la URL de Render del Paso 2.5 + `/api`) |

**Ejemplo**: Si tu URL de Render es `https://stripe-connector-backend.onrender.com`, pon:
```
https://stripe-connector-backend.onrender.com/api
```

### 3.4 Desplegar
1. Haz clic en "Deploy"
2. Espera 2-3 minutos
3. Cuando termine, verás "Congratulations!" 🎉
4. Haz clic en "Visit" para ver tu app
5. **COPIA LA URL** (ejemplo: `https://stripe-connector.vercel.app`)

---

## 👤 PASO 4: Crear tu Primer Usuario Admin

### 4.1 Registrarte en la App
1. Abre tu app en Vercel (la URL del Paso 3.4)
2. Haz clic en "Regístrate"
3. Completa el formulario:
   - Nombre
   - Email
   - Contraseña
4. Haz clic en "Registrarse"

### 4.2 Convertir usuario en Admin (usando MongoDB Atlas)
1. Ve a MongoDB Atlas: https://cloud.mongodb.com
2. Haz clic en "Browse Collections"
3. Busca la colección `users`
4. Verás tu usuario que acabas de crear
5. Haz clic en el ícono de editar (lápiz)
6. Busca el campo `role` y cámbialo de `user` a `admin`
7. Haz clic en "Update"

### 4.3 Probar el Panel Admin
1. Refresca tu app (F5)
2. Ahora deberías ver un botón "🔧 Admin Panel" en la esquina superior derecha
3. Haz clic en él
4. ¡Deberías ver el panel de administrador! 🎉

---

## ✅ PASO 5: Probar que Todo Funciona

### Prueba 1: Login y Registro
- ✅ Puedes registrar nuevos usuarios
- ✅ Puedes iniciar sesión
- ✅ Ves tu nombre y plan (Free)

### Prueba 2: Dashboard
- ✅ Puedes buscar transacciones fallidas
- ✅ Ves la información de clientes
- ✅ Puedes reintentar pagos

### Prueba 3: Panel Admin (solo si eres admin)
- ✅ Ves todos los usuarios
- ✅ Ves estadísticas
- ✅ Puedes cambiar plan de usuarios (Free ↔ Premium)

---

## 🎯 URLs Importantes (Guárdalas)

Anota estas URLs:

| Servicio | URL | Para qué sirve |
|----------|-----|----------------|
| **Frontend (Tu App)** | `https://tu-app.vercel.app` | Los usuarios entran aquí |
| **Backend (API)** | `https://tu-backend.onrender.com` | Maneja la lógica |
| **Base de Datos** | MongoDB Atlas | Guarda usuarios y datos |

---

## 🐛 Problemas Comunes

### "No puedo conectar a la base de datos"
- Verifica que copiaste bien la URL de MongoDB
- Verifica que reemplazaste `<password>` con tu contraseña real
- Verifica que agregaste `/stripe_connector` al final

### "Error de CORS" o "Network error"
- Verifica que `REACT_APP_API_URL` termine en `/api`
- Verifica que la URL del backend sea correcta

### "El login no funciona"
- Verifica que `JWT_SECRET` esté configurado en Render
- Revisa los logs en Render para ver el error

### "No veo el panel de admin"
- Asegúrate de haber cambiado `role` a `admin` en MongoDB
- Cierra sesión y vuelve a iniciar sesión

---

## 🔐 Seguridad - IMPORTANTE

✅ **Lo que hicimos para proteger tu app:**
- Contraseñas encriptadas
- Tokens JWT seguros
- Clave de Stripe solo en el backend
- Solo admins pueden acceder al panel

⚠️ **Nunca hagas esto:**
- Nunca compartas tus claves (JWT_SECRET, STRIPE_SECRET_KEY)
- Nunca subas archivos `.env` a GitHub
- Nunca uses contraseñas débiles

---

## 🎉 ¡Felicidades!

Tu aplicación está desplegada y funcionando. Ahora puedes:

1. ✅ Registrar usuarios (todos empiezan con plan Free)
2. ✅ Ver transacciones fallidas de Stripe
3. ✅ Gestionar usuarios desde el panel admin
4. ✅ Cambiar planes de usuarios

**¡Ya tienes tu Stripe Connector en producción!** 🚀

---

## 📞 ¿Necesitas Ayuda?

Si algo no funciona:
1. Revisa los logs en Render (sección "Logs")
2. Revisa la consola del navegador (F12 → Console)
3. Verifica que todas las variables estén bien configuradas
