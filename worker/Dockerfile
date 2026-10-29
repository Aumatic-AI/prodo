FROM node:24-bookworm-slim

# ffmpeg for the small video jobs; the rest are the libraries Remotion's headless browser needs
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ffmpeg ca-certificates fonts-dejavu-core fonts-noto-color-emoji \
     libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 \
     libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node remotion ./remotion
COPY --chown=node:node scripts ./scripts

# Bundle the templates and download the headless browser now, not on the first render
RUN node scripts/build.ts

ENV NODE_ENV=production PORT=8080
EXPOSE 8080

# Node 24 runs TypeScript directly
CMD ["node", "src/server.ts"]
