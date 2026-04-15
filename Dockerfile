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

# Don't run as root
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy built app (public may be empty — ensure dir exists)
RUN mkdir -p ./public
COPY --from=builder /app/public/ ./public/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
