# ⚡ Inicio Rápido - 5 Minutos

## 📋 Antes de empezar necesitas:

1. **MongoDB Atlas** (base de datos gratis)
   - Ve a: https://www.mongodb.com/cloud/atlas
   - Crea cuenta → Crea cluster gratis
   - Copia la URL de conexión

2. **Tu clave de Stripe**
   - Ve a: https://dashboard.stripe.com/test/apikeys
   - Copia la "Secret key" (empieza con `sk_test_...`)

---

## 🚀 Pasos para Iniciar

### 1. Instalar todo
```bash
# En la carpeta principal del proyecto:
npm install

# Ir al backend e instalar:
cd backend
npm install
cd ..
```

### 2. Configurar el Backend

```bash
cd backend
cp .env.example .env
```

Abre `backend/.env` y pon tus datos:
```
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/stripe_connector
JWT_SECRET=mi-clave-super-secreta-123
STRIPE_SECRET_KEY=sk_test_tu_clave_de_stripe_aqui
PORT=5000
```

### 3. Configurar el Frontend

```bash
cd ..
cp .env.example .env
```

El archivo `.env` ya tiene lo necesario:
```
REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Iniciar todo

**Abrir 2 terminales:**

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```
Deberías ver: ✅ Conectado a MongoDB

**Terminal 2 (Frontend):**
```bash
npm start
```
Se abrirá el navegador en http://localhost:3000

### 5. Usar la app

1. Haz clic en "Regístrate"
2. Llena tus datos
3. Inicia sesión
4. Busca transacciones fallidas

---

## 🐛 Si algo no funciona:

### Error: "Cannot connect to MongoDB"
- Verifica que pegaste bien la URL en `backend/.env`
- En MongoDB Atlas, permite acceso desde "0.0.0.0/0"

### Error: "Network error" en el navegador
- Asegúrate que el backend esté corriendo (Terminal 1)
- Verifica que `REACT_APP_API_URL` sea `http://localhost:5000/api`

### No carga transacciones
- Verifica que tu `STRIPE_SECRET_KEY` sea correcta
- Asegúrate de tener transacciones fallidas en Stripe

---

## ✅ Todo listo

Ahora puedes:
- ✨ Registrar usuarios
- 🔐 Sistema de login seguro
- 📊 Ver transacciones fallidas
- 🔄 Reintentar pagos

## 📚 Siguiente paso

Para desplegar en producción, lee: [DESPLIEGUE.md](DESPLIEGUE.md)
