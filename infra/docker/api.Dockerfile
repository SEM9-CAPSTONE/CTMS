FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY services/api/package.json services/api/package.json
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY services/api services/api
RUN pnpm --filter @ctms/api build

FROM deps AS production-deps
# pnpm deploy creates a self-contained dependency tree for this service only.
# Keep the workspace's web, test and build dependencies out of the runtime.
RUN pnpm --filter @ctms/api --prod deploy /prod/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# The API and dedicated basemap worker use the same deployable image.
RUN apk add --no-cache python3 py3-pillow font-dejavu
COPY --from=production-deps /prod/api/node_modules ./services/api/node_modules
COPY --from=build /app/services/api/dist ./services/api/dist
COPY services/api/package.json ./services/api/package.json
COPY services/api/scripts ./services/api/scripts
COPY scripts/build_osm_raster.py ./scripts/build_osm_raster.py
# Check dependency resolution and bcrypt's native binary in the Linux runtime,
# including the pg/dotenv dependencies used by the dedicated basemap worker.
RUN node -e "const r=require('node:module').createRequire('/app/services/api/package.json'); for (const name of Object.keys(r('./package.json').dependencies)) r.resolve(name); r('bcrypt').hashSync('ctms-image-check',4)"
EXPOSE 3000
CMD ["node", "services/api/dist/main.js"]
