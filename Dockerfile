FROM mcr.microsoft.com/playwright:v1.64.1-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.64.1-noble AS runner

WORKDIR /app

# Instalar Xvfb para pantalla virtual en Docker
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=false
ENV DATA_PATH=/app/data/seen_ids.json

COPY package*.json ./
RUN npm ci --omit=dev

# Asegurar que los navegadores requeridos estén instalados
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
