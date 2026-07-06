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
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* && \
    mkdir -p src/assets/mediapipe/wasm && \
    cp -r node_modules/@mediapipe/tasks-vision/wasm/* src/assets/mediapipe/wasm/ && \
    curl -sL -o src/assets/mediapipe/pose_landmarker_lite.task \
      https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task

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