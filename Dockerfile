# ── Peanut Gallery — Production Dockerfile ──
# Node.js + yt-dlp + ffmpeg for the real-time pipeline
# Note: YT_DLP_COOKIE_BROWSER won't work in Docker (no browser).
# For age-restricted or login-required videos, use YT_DLP_COOKIES_FILE
# with a Netscape-format cookies.txt mounted as a volume instead.

FROM node:20-slim AS base

# Install system deps: ffmpeg, yt-dlp, python3 (yt-dlp needs it)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Build stage ──
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Next.js collects telemetry — disable in CI
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Production stage ──
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy built app (public may be empty — ensure dir exists)
RUN mkdir -p ./public
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Ship the admin subscription CLI so `railway ssh` → `tsx scripts/...`
# works without having to rebuild arbitrary node-inline pipelines for
# every ops cleanup. subscription-admin.ts is standalone (only imports
# better-sqlite3 which is a runtime dep); subscription-issue.ts needs
# lib/ too and is used more rarely, so we ship only the standalone one.
COPY --from=builder /app/scripts/subscription-admin.ts ./scripts/subscription-admin.ts

# tsx for running .ts admin scripts on the container. ~5MB and avoids
# the `npm i -g tsx` dance on every railway ssh session.
RUN npm install -g tsx

# Running as root in-container. Railway's persistent volumes mount as
# root:root; a non-root USER can't write SQLite to /data without a
# gosu/su-exec privilege-drop dance in the entrypoint. Container
# isolation is the real security boundary here, not the in-container
# UID, so this is the pragmatic trade-off that unblocks subscription
# persistence. (See lib/subscription-store.ts + docs/SUBSCRIPTION-ARCHITECTURE.md.)

EXPOSE 3000

CMD ["node", "server.js"]
