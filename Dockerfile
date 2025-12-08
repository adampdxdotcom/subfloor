# --- STAGE 1: BUILD THE FRONTEND ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy ROOT package files (Frontend deps)
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build


# --- STAGE 2: SETUP THE PRODUCTION SERVER ---
FROM node:20-alpine AS production-runner

WORKDIR /app

# Install PostgreSQL Client Tools (Required for Backup/Restore/Healthchecks)
RUN apk add --no-cache postgresql-client

# 1. Copy SERVER package files to ROOT (Flattening structure)
COPY server/package*.json ./

# 2. Install production dependencies
RUN npm install --only=production

# 3. Copy server source code to ROOT
# (This puts index.js at /app/index.js, right next to package.json)
COPY server/ .

# 4. Copy Migrations from project root to container root
COPY migrations/ ./migrations/

# 5. Copy Schema from project root (Required for dbInit.js)
COPY schema.sql ./schema.sql

# 6. Copy Frontend Build from Stage 1
# (We put it in 'public' because index.js usually serves static files from there)
COPY --from=frontend-builder /app/dist ./public

# 7. Create uploads directories
RUN mkdir -p uploads/branding && \
    mkdir -p uploads/avatars && \
    mkdir -p temp-uploads

# Expose the API port
EXPOSE 3001

# Start the server
# This runs: "node-pg-migrate up && node index.js"
CMD ["npm", "start"]