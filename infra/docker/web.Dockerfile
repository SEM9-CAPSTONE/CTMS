FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY services/api/package.json services/api/package.json
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:3000/api
ARG VITE_MAPTILER_API_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAPTILER_API_KEY=$VITE_MAPTILER_API_KEY
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN pnpm --filter @ctms/web build

FROM nginx:1.27-alpine AS runner
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
