# The multi-architecture digest fixes the official Node 24 Debian base.
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
LABEL io.kivro.openclaw.version="2026.8.2"

WORKDIR /opt/kivro
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && node -e "const p=require('./node_modules/openclaw/package.json'); if(p.version!=='2026.8.2') process.exit(1)" \
    && chmod -R a+rX /opt/kivro
ENV PATH=/opt/kivro/node_modules/.bin:/usr/local/bin:/usr/bin:/bin
ENV OPENCLAW_CONFIG_PATH=/job/input/config.json
ENV OPENCLAW_STATE_DIR=/job/work/.openclaw/state
COPY bridge.mjs ./
COPY runner.mjs ./
COPY plugin ./plugin
RUN openclaw plugins build --root /opt/kivro/plugin --entry ./index.mjs --check \
    && openclaw plugins validate --root /opt/kivro/plugin --entry ./index.mjs

USER 65532:65532
ENTRYPOINT ["node", "/opt/kivro/runner.mjs"]
