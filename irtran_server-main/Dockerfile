# Backend IrTRAN (Node) — Debian-based образ для стабильной сборки java/bcrypt (node-gyp в Alpine падает по сети)
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# node-gyp (bcrypt) + JDK для пакета java (binding.gyp вызывает findJavaHome.js)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Финальный образ: JRE нужен для aspose.cells (вызовы Java из Node)
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
