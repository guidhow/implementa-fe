#!/bin/sh
set -e

# Default backend URL if not provided
: "${BACKEND_URL:=http://localhost:8000}"

# Substitute BACKEND_URL in the Nginx template
# Only replace $BACKEND_URL (not other Nginx variables like $uri, $host, etc.)
envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Nginx configured with BACKEND_URL=${BACKEND_URL}"

# Start Nginx
exec nginx -g "daemon off;"
