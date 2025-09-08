# Use official Node.js LTS image
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (change if your backend uses a different port)
EXPOSE 4000

# Start the app
CMD ["node", "dist/index.js"]