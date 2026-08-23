## Multi-stage Dockerfile to build frontend and backend and produce a runnable image

FROM node:20 AS frontend-builder
WORKDIR /project
COPY frontend/package.json frontend/package-lock.json* frontend/vite.config.js frontend/index.html ./frontend/
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY backend ./backend
WORKDIR /project/frontend
RUN npm ci --no-audit --no-fund && npm run build

FROM gradle:8.4-jdk21 AS backend-builder
WORKDIR /project
COPY --from=frontend-builder /project /project
RUN chmod +x backend/gradlew || true
WORKDIR /project/backend
RUN ./gradlew bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=backend-builder /project/backend/build/libs/*.jar app.jar
EXPOSE 5172
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
