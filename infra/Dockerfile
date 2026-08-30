FROM node:22-slim
WORKDIR /app
# Lockfile-driven install, cached until dependencies actually change.
# tsx is a runtime dependency (it is the entrypoint), so --omit=dev keeps it.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
CMD ["npx", "tsx", "apps/orchestrator/src/server.ts"]
