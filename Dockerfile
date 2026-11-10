FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
# pnpm-workspace.yaml carries the build-script decisions (allowBuilds); pnpm 11 stops without them
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are baked into the build (pages, emails, sitemap), so they
# must be known here, not only when the container starts. Pass them as build args:
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://eventflow.in ...
# (docker compose passes them from the shell / .env automatically.)
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_ROOT_DOMAIN=""
ARG NEXT_PUBLIC_LEGAL_ENTITY=""
ARG NEXT_PUBLIC_LEGAL_JURISDICTION=""
ARG NEXT_PUBLIC_GRIEVANCE_OFFICER=""
ARG NEXT_PUBLIC_PRIVACY_EMAIL=""
ARG NEXT_PUBLIC_SUPPORT_EMAIL=""
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN \
    NEXT_PUBLIC_LEGAL_ENTITY=$NEXT_PUBLIC_LEGAL_ENTITY \
    NEXT_PUBLIC_LEGAL_JURISDICTION=$NEXT_PUBLIC_LEGAL_JURISDICTION \
    NEXT_PUBLIC_GRIEVANCE_OFFICER=$NEXT_PUBLIC_GRIEVANCE_OFFICER \
    NEXT_PUBLIC_PRIVACY_EMAIL=$NEXT_PUBLIC_PRIVACY_EMAIL \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
RUN npx prisma generate
RUN pnpm build

# One-off: apply database migrations (prisma/migrations) before starting a new version.
#   docker compose run --rm migrate
FROM builder AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# User uploads live outside public/ in a writable dir (mount a volume here to persist them)
ENV UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# The port: Zoho Catalyst AppSail tells the app which port to use in
# X_ZOHO_CATALYST_LISTEN_PORT; everywhere else PORT (default 3000) applies.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD sh -c 'wget -qO /dev/null "http://127.0.0.1:${X_ZOHO_CATALYST_LISTEN_PORT:-${PORT:-3000}}/api/health"' || exit 1
CMD ["sh", "-c", "PORT=${X_ZOHO_CATALYST_LISTEN_PORT:-${PORT:-3000}} exec node server.js"]
