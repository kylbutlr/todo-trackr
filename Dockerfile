FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build:web && npm run build:server
RUN rm -rf apps/web/dist/updates && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production TODO_TRACKER_RUNTIME=standalone TODO_TRACKER_HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /app/database ./database
COPY --from=build --chown=node:node /app/scripts/migrate-database.mjs ./scripts/migrate-database.mjs
COPY --from=build --chown=node:node /app/LICENSE ./LICENSE
COPY --from=build --chown=node:node /app/design/GEIST-LICENSE.txt ./licenses/GEIST-LICENSE.txt
USER node
EXPOSE 8888
CMD ["sh", "-c", "node scripts/migrate-database.mjs && exec node dist/server.mjs"]
