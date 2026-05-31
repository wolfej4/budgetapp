# ---- build client ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- production image ----
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /app/data

ENV PORT=6000
ENV JWT_SECRET=change-me-in-production
EXPOSE 6000

CMD ["node", "server/index.js"]
