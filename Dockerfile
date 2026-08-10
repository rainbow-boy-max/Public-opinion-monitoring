FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY pnpm-lock.yaml package.json ./
COPY backend/package.json backend/
COPY frontend-admin/package.json frontend-admin/
COPY frontend-user/package.json frontend-user/

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

RUN corepack enable && pnpm --filter backend run build
RUN corepack enable && pnpm --filter frontend-admin run build
RUN corepack enable && pnpm --filter frontend-user run build

FROM node:20-alpine AS backend

WORKDIR /app

RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]

FROM nginx:alpine AS frontend-admin

COPY --from=builder /app/frontend-admin/dist /usr/share/nginx/html
COPY deploy/nginx-admin.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM nginx:alpine AS frontend-user

COPY --from=builder /app/frontend-user/dist /usr/share/nginx/html
COPY deploy/nginx-user.conf /etc/nginx/conf.d/default.conf
EXPOSE 80