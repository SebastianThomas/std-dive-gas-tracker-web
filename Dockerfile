# ---------- builder ----------
FROM node:26-slim AS builder
WORKDIR /app

# staging (dev deploy) or production: Vite bakes the API URLs of vue/.env.<mode> into the bundle.
ARG BUILD_MODE=production

COPY ./vue/package.json ./vue/yarn.lock ./
RUN yarn install --frozen-lockfile

COPY ./vue ./
RUN yarn build-only --mode $BUILD_MODE

# ---------- runner ----------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
