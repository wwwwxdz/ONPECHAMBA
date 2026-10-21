# 🤖 ONPE Alertas Bot (Santa / Perú)

Bot automatizado y escalable diseñado para monitorear convocatorias de locación de servicios en el portal de reclutamiento de la ONPE, evadiendo la protección de Cloudflare mediante Playwright y enviando alertas en tiempo real a tu Telegram.

## 🚀 Características
- **Bypass de Cloudflare:** Carga la sesión en un navegador headless y ejecuta las peticiones desde el contexto autorizado.
- **Detección de Nuevas Convocatorias:** Registra los IDs de convocatorias ya notificadas en un archivo persistente (`seen_ids.json`) para evitar duplicados.
- **Filtro por ODPE:** Configurado por defecto para la sede **SANTA** (`idOdp: 85`), extensible a cualquier otra sede u ODPE mediante variables de entorno.
- **Listo para Dokploy:** Incluye `Dockerfile` y `docker-compose.yml` listos para desplegar en tu propio servidor VPS.

---

## 🛠️ Configuración de Telegram (Gratis en 2 minutos)

1. **Crear el Bot:**
   - Abre Telegram y busca `@BotFather`.
   - Envía `/newbot`, ponle un nombre y un usuario (ej: `MiOnpeAlertasBot`).
   - Copia el **HTTP API Token** que te entrega.

2. **Obtener tu Chat ID:**
   - Abre Telegram y busca `@userinfobot`.
   - Dale a `Iniciar` y copia el número que dice **Id**.

3. **Crear archivo `.env`:**
   ```bash
   cp .env.example .env
   ```
   Rellena `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

---

### 🧪 Probar la petición en tu máquina local:
Puedes ejecutar en cualquier momento:
```bash
npm run test:request
```
Esto abrirá el navegador por 3 segundos, consultará la ONPE burlando a Cloudflare, imprimirá el JSON en consola y te mandará un mensaje de confirmación a tu celular.

---

## 💻 Despliegue en Dokploy

1. Crea una nueva aplicación en tu panel de **Dokploy**:
   - **Type:** Compose (o Dockerfile).
   - **Source:** Conecta tu repositorio de GitHub o sube los archivos directamente.
2. En la pestaña **Environment Variables** en Dokploy, agrega:
   ```env
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   TELEGRAM_CHAT_ID=tu_chat_id_aqui
   ONPE_ID_ODP=85
   ONPE_ODP_NOMBRE=SANTA
   CRON_SCHEDULE=*/30 * * * *
   ```
3. En la pestaña **Volumes** (si usas Dockerfile directo):
   - Monta `/app/data` para persistir los IDs y evitar duplicados tras reinicios.
4. Presiona **Deploy**. ¡Listo! El bot enviará un mensaje inicial a tu Telegram confirmando su encendido y revisará cada 30 minutos.
# ONPECHAMBA
