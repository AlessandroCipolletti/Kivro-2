# The multi-architecture digest fixes the official Node 22 Debian base.
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

WORKDIR /opt/kivro
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && node -e "const p=require('./node_modules/openclaw/package.json'); if(p.version!=='2026.8.2') process.exit(1)" \
    && chmod -R a+rX /opt/kivro

ENV PATH=/opt/kivro/node_modules/.bin:/usr/local/bin:/usr/bin:/bin
USER 65532:65532
ENTRYPOINT ["openclaw"]
