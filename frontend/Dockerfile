# ---------- Stage 1: build the React app ----------
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- Stage 2: serve with nginx ----------
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
