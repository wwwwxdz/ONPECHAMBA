FROM mcr.microsoft.com/playwright:v1.49.0-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.49.0-noble AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_HEADLESS=true
ENV DATA_PATH=/app/data/seen_ids.json

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Crear directorio de persistencia para el volumen de Dokploy
RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
