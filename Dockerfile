# =========================
# Stage 1: Build NestJS app
# =========================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package.json và package-lock.json trước (để cache npm install)
COPY package*.json ./

# Cài dependencies đầy đủ (dev + prod) để build
RUN npm ci --legacy-peer-deps

# Copy toàn bộ source
COPY . .

# Build NestJS (tạo dist/)
RUN npm run build

# =========================
# Stage 2: Run NestJS app
# =========================
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json và lockfile
COPY package*.json ./

# Cài dependencies production
RUN npm ci --only=production --legacy-peer-deps

# Copy dist đã build từ stage 1
COPY --from=builder /usr/src/app/dist ./dist

# Expose port 8080 (match docker-compose)
EXPOSE 8080

# Start app
CMD ["node", "dist/src/main.js"]
