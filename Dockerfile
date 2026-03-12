FROM node:20-alpine AS base
WORKDIR /app

# ─── Server build ───
FROM base AS server-deps
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM base AS server-build
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx tsc

FROM base AS server
COPY --from=server-deps /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY server/package.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]
