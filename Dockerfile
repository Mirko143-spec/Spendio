FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# Only what the build needs: tests, lint and typecheck run in CI, not in the image build.
# Far fewer files keeps the build (and kaniko's filesystem snapshots) small enough for the cluster.
RUN npm ci --omit=dev
COPY . .
RUN npx vite build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
