FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && npm install tsx
COPY . .
CMD ["npx", "tsx", "apps/orchestrator/src/server.ts"]
