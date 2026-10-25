FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node

# Node 24 runs TypeScript directly
CMD ["node", "src/server.ts"]
