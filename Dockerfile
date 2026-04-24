FROM node:18-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/types/package*.json ./packages/types/
COPY packages/api-client/package*.json ./packages/api-client/

# Install dependencies
RUN npm install --production --legacy-peer-deps

# Copy source code
COPY apps/api ./apps/api
COPY packages/types ./packages/types
COPY packages/api-client ./packages/api-client

# Build TypeScript
WORKDIR /app/apps/api
RUN npm run build

# Expose port
EXPOSE 3003

# Start server
CMD ["node", "dist/index.js"]
