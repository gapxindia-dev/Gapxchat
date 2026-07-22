# Stage 1: Build both React client and Express server
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency files and install
COPY repo/package.json ./
RUN npm install --legacy-peer-deps

# Copy all source files
COPY repo/ .

# Compile code bases
RUN npm run build

# Stage 2: Create a minimal runner container
FROM node:24-alpine

WORKDIR /app

# Copy root configurations
COPY repo/package.json ./

# Install only production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled assets from build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist

# Set production execution configurations
EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000

CMD ["npm", "start"]
