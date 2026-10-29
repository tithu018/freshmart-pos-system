# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Public build configuration only. Never put secrets in VITE_ variables.
ENV VITE_API_BASE_URL=/api
RUN npm test && npm run build

FROM nginx:stable-alpine AS runtime
# Apply available Alpine security fixes before dropping privileges. Trivy gates
# the resulting image; the moving upstream base may lag its package repository.
RUN apk upgrade --no-cache brotli-libs curl libcurl
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /build/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
