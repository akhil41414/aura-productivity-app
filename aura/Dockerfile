# --- Stage 1: build the Vite frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: backend + built frontend ---
FROM node:20-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm install --omit=dev
COPY server/ .
# Drop the built frontend into a "public" folder the server serves statically
COPY --from=frontend-build /app/dist ./public

ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
