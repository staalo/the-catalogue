# Build from the repository root (the-catalogue):
#   docker build -t catalogue .
#   docker compose up --build

FROM node:24-bookworm-slim AS ui-build
WORKDIR /ui
COPY catalogue-ui/package.json catalogue-ui/package-lock.json ./
RUN npm ci
COPY catalogue-ui/ ./
# Relative /api URLs so the browser talks to the same origin (LAN IP or localhost).
ENV VITE_API_BASE_URL=
RUN npm run build

FROM node:24-bookworm-slim AS api-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY catalogue-service/package.json catalogue-service/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS api-build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY catalogue-service/package.json catalogue-service/package-lock.json ./
RUN npm ci
COPY catalogue-service/tsconfig.json ./
COPY catalogue-service/src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data /media/movies /media/tv \
  && chown -R node:node /app /data /media

COPY --from=api-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=api-build --chown=node:node /app/dist ./dist
COPY --from=api-build --chown=node:node /app/package.json ./
COPY --from=ui-build --chown=node:node /ui/dist ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/data/catalog.db
ENV PUBLIC_DIR=/app/public
ENV MOVIES_PATH=/media/movies
ENV TV_PATH=/media/tv

EXPOSE 3000
USER node
CMD ["node", "dist/app/index.js"]
