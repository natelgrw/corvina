FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Expose Vite port
EXPOSE 5173

# Run development server with host flag
CMD ["npm", "run", "dev", "--", "--host"]
