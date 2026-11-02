FROM node:20-alpine AS base

# Install ffmpeg & dependencies for audio/video processing
RUN apk add --no-cache ffmpeg libc6-compat

WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json* ./
RUN npm ci

# Copy all source files
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# Expose app port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run with standard Next.js production server
CMD ["npm", "start"]
