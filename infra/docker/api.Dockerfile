FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY services/api/package.json services/api/package.json
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY services/api services/api
RUN pnpm --filter @ctms/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/api/dist ./services/api/dist
COPY services/api/package.json ./services/api/package.json
EXPOSE 3000
CMD ["node", "services/api/dist/main.js"]
