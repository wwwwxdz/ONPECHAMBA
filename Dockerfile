FROM mcr.microsoft.com/playwright:v1.49.0-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.49.0-noble AS runner

WORKDIR /app

# Instalar Xvfb para evadir Cloudflare con pantalla virtual
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=false
ENV DATA_PATH=/app/data/seen_ids.json

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

# Copiar script de arranque con permisos de ejecución
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
