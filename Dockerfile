# Stage 1: build NestJS app
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# copy package.json và package-lock.json
COPY package*.json ./

# cài dependencies (bao gồm dev)
RUN npm install --legacy-peer-deps

# copy toàn bộ source
COPY . .

# build app (tạo dist/)
RUN npm run build

# Stage 2: run app
FROM node:18-alpine

WORKDIR /usr/src/app

# copy package.json
COPY package*.json ./

# chỉ cài dependency production
RUN npm install --only=production --legacy-peer-deps

# copy code đã build từ stage 1
COPY --from=builder /usr/src/app/dist ./dist

# expose port 8080 (match với docker-compose)
EXPOSE 8080

# run app
CMD ["node", "dist/main.js"]
