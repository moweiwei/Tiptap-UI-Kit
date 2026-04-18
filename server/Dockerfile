FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && cp -r src/db/migrations dist/db/migrations
EXPOSE 1234
CMD ["node", "dist/index.js"]
