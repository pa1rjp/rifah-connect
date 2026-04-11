# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Receive API credentials as build args (passed from docker-compose / .env)
ARG VITE_API_KEY
ARG VITE_API_SECRET
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_API_SECRET=$VITE_API_SECRET

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
