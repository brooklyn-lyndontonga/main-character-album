# Use official Node.js runtime as parent image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json files
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install --prefix backend
RUN npm install --prefix frontend --legacy-peer-deps

# Copy the rest of the application files
COPY . .

# Build the frontend production assets
RUN npm run build --prefix frontend

# Set Environment Variables
ENV PORT=5001
ENV NODE_ENV=production
ENV DATABASE_DIR=/app/backend/data

# Create data directory for persistence
RUN mkdir -p /app/backend/data

# Expose port
EXPOSE 5001

# Start the application
CMD ["node", "backend/server.js"]
