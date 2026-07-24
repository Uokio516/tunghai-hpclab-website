FROM node:20-alpine

WORKDIR /app

# Install dependencies (cached when package.json unchanged)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source and build frontend assets
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# SQLite data directory (overridden by volume mount at runtime)
RUN mkdir -p data

CMD ["npx", "tsx", "server.ts"]
