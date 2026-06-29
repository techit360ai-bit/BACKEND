# Build
FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

# Run
FROM alpine:3.20
RUN adduser -D -u 10001 app
COPY --from=build /server /server
# migrations are read at runtime relative to workdir
COPY --from=build /app/internal/store/migrations /app/internal/store/migrations
WORKDIR /app
USER app
EXPOSE 8080
ENTRYPOINT ["/server"]
