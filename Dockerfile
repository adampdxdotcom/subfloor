# Dockerfile

# Use a modern, lightweight version of Node.js as our base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage layer caching
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of your application's source code
COPY . .

# Vite's default port is 5173. We expose it from the container.
EXPOSE 5173

# The command to run the Vite dev server
CMD ["npm", "run", "dev"]