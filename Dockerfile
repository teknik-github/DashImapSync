# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies first to leverage layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build Nuxt app
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

# Install Perl and all imapsync runtime dependencies, then download imapsync binary
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        wget \
        perl \
        libauthen-ntlm-perl \
        libcgi-pm-perl \
        libcrypt-openssl-rsa-perl \
        libdata-uniqid-perl \
        libdigest-hmac-perl \
        libdist-checkconflicts-perl \
        libencode-imaputf7-perl \
        libfile-copy-recursive-perl \
        libfile-tail-perl \
        libio-compress-perl \
        libio-socket-inet6-perl \
        libio-socket-ssl-perl \
        libio-tee-perl \
        libjson-webtoken-perl \
        libmail-imapclient-perl \
        libmodule-scandeps-perl \
        libnet-dbus-perl \
        libnet-ssleay-perl \
        libreadonly-perl \
        libregexp-common-perl \
        libsys-meminfo-perl \
        libterm-readkey-perl \
        libunicode-string-perl \
        liburi-perl \
        libwww-perl \
    && wget -N https://raw.githubusercontent.com/imapsync/imapsync/master/imapsync \
    && chmod +x imapsync \
    && cp imapsync /usr/bin/ \
    && rm imapsync \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the compiled Nitro output from the build stage
COPY --from=builder /app/.output ./.output

# Directory used by imapsync for runtime logs
RUN mkdir -p /app/LOG_imapsync

# Run as non-root user for security
RUN groupadd --system appuser \
    && useradd --system --gid appuser appuser \
    && chown -R appuser:appuser /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Mount this volume to persist imapsync logs outside the container
VOLUME ["/app/LOG_imapsync"]

CMD ["node", ".output/server/index.mjs"]
