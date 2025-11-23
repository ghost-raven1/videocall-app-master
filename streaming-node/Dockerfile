# Build stage
FROM golang:1.21-alpine AS builder

# Install necessary packages for building
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod file
COPY go.mod ./

# Download dependencies (this will generate go.sum)
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Tidy dependencies to ensure go.mod is up to date
RUN go mod tidy

# Build the application (use -mod=mod to ignore vendor directory if inconsistent)
RUN CGO_ENABLED=0 GOOS=linux go build -mod=mod -a -installsuffix cgo -o streaming-node .

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata wget

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/streaming-node .

# Copy config file
COPY --from=builder /app/config.yaml .

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./streaming-node", "--config", "config.yaml"]