# ---------- Build ----------
FROM golang:1.24-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY main.go .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# ---------- Run ----------
FROM alpine:3.19

WORKDIR /app

COPY --from=builder /build/server .

RUN mkdir -p dataset

EXPOSE 5001

CMD ["./server"]
