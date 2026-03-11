FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:24-slim

WORKDIR /app

COPY --from=builder /app/.medusa/server ./
RUN npm ci --omit=dev --no-audit --no-fund

ENV NODE_ENV=production

EXPOSE 9000

CMD ["npm", "run", "start"]
