# syntax=docker/dockerfile:1.6
# ---------- Stage 1: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Install deps first for layer caching.
# Use `npm ci` when a lockfile is present (reproducible); fall back to
# `npm install` on first run when only package.json is committed.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

# Copy source and build static assets.
COPY . .
RUN npm run build


# ---------- Stage 2: Runtime (nginx) ----------
FROM nginx:alpine AS runtime

# Replace default site with our SPA + API proxy config.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
