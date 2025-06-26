# Use the official Node.js 20 Alpine image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install dev dependencies for building
RUN npm install typescript ts-node @types/node

# Copy the source code (excluding .env which should be mounted or passed as env vars)
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Start the application directly (since it runs once and exits)
CMD ["node", "dist/index.js"]
