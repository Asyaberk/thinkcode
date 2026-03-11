# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Sadece bağımlılık dosyalarını kopyala (layer cache için)
COPY package.json package-lock.json ./
RUN npm ci

# Kaynak kodları kopyala
COPY . .

# Build-time env değişkeni (vite.config.ts'te define ile işlenir)
ARG GEMINI_API_KEY=""
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Vite build (env değişkenleri build anında inject edilir)
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Build çıktısını nginx'e kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing için nginx konfigürasyonu
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
