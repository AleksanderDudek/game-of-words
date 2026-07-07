FROM node:20-alpine AS base
WORKDIR /app

# ─── Install production deps only ───
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Build server TypeScript ───
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY tsconfig.server.json ./
COPY src/server/ src/server/
COPY src/shared/ src/shared/
RUN npx tsc -p tsconfig.server.json

# ─── Final slim image ───
FROM base AS server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist/server ./dist/server
COPY package.json ./
# Topical word packs are read from disk at startup (see wordgen.ts loadPackFiles)
COPY packs/ ./packs/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server/server/index.js"]
