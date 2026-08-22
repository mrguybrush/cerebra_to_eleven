FROM node:18 AS builder

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

# Self-host MediaPipe assets (WASM runtime ships inside the already-installed
# @mediapipe/tasks-vision package; the model is fetched once here at build
# time) instead of fetching from external CDNs at runtime - the operator's
# browser previously needed internet access just to start gesture tracking,
# which failed on networks without it. Matches the project's offline-first
# approach. See browser-pose-tracker.service.ts.
# "apt-get update" retry: on a Pi that just came back from an unexpected
# power loss (no battery-backed RTC), the clock or network can still be
# settling for a few seconds, which showed up as a hard-to-reproduce
# "GPG error ... At least one invalid signature was encountered" here -
# confirmed transient (a live rerun of the exact same apt-get update right
# after succeeded cleanly). A single flaky apt-get update should not throw
# away this build's whole (expensive) npm install + build. curl gets
# --retry for the same class of transient network hiccup, plus -f so a
# failed/HTML-error-page download fails loudly instead of silently writing
# garbage as the model file.
RUN set -e; \
    for i in 1 2 3 4 5; do \
      apt-get update && break; \
      echo "apt-get update fehlgeschlagen (Versuch $i/5), erneuter Versuch in 10s..."; \
      sleep 10; \
      if [ "$i" = "5" ]; then exit 1; fi; \
    done && \
    apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* && \
    mkdir -p src/assets/mediapipe/wasm && \
    cp -r node_modules/@mediapipe/tasks-vision/wasm/* src/assets/mediapipe/wasm/ && \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 10 -o src/assets/mediapipe/pose_landmarker_lite.task \
      https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task && \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 10 -o src/assets/mediapipe/hand_landmarker.task \
      https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task

ARG NODE_ENV=production
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm run build --prod; \
    else \
      npm run build; \
    fi

FROM nginx:1.25.4

COPY --from=builder /app/dist/ /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]