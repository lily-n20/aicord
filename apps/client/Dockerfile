FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/client/package.json ./apps/client/
RUN pnpm install --frozen-lockfile
COPY packages/shared ./packages/shared
COPY apps/client ./apps/client
RUN pnpm --filter @aicord/shared build
RUN pnpm --filter client build

FROM nginx:alpine
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
