FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx template and entrypoint
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Backend URL injected at runtime (env var on Container App)
ENV BACKEND_URL=http://localhost:8000

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
