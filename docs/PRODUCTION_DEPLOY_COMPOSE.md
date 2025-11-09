# Production Deployment via Docker Compose

This guide describes a minimal, secure production deployment using `docker-compose.prod.yml` with Nginx terminating TLS and internal-only backend/SFU services.

## Prerequisites
- Linux server with `docker` and `docker-compose`
- DNS pointing `your-domain.com` and `www.your-domain.com` to the server
- Ports `80` and `443` open

## 1) Configure environment
```bash
cp .env.production.example .env
# Edit .env: set SECRET_KEY, JWT_SECRET, ADMIN_PASSWORD, domain values
```

Run configuration checks:
```bash
scripts/check-config.sh
```

## 2) Obtain TLS certificates (optional at this step)
If you use system Nginx with Certbot outside containers, obtain certificates first and mount `/etc/letsencrypt` into the nginx container (already configured in compose).

```bash
sudo apt update && sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

## 3) Start the stack
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

Services:
- `db`, `redis` – internal state
- `static-init` – collects static and runs migrations once
- `backend` – Django ASGI, internal-only
- `streaming-node` – SFU, internal-only
- `frontend` – Vue app, internal-only
- `nginx` – public entry, serves HTTPS and proxies to internal services

## 4) Health checks
```bash
docker-compose -f docker-compose.prod.yml ps
curl -f http://localhost/health/
docker-compose -f docker-compose.prod.yml logs --tail=200 nginx backend streaming-node
```

Backend health (internal):
```bash
docker-compose -f docker-compose.prod.yml exec backend curl -f http://localhost:8000/api/health/
```

SFU health (internal):
```bash
docker-compose -f docker-compose.prod.yml exec streaming-node wget -qO- http://localhost:8080/health
```

## 5) Post-deploy validation
- Ensure `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `SERVER_ALLOWED_ORIGINS` reflect your domain(s)
- Verify HTTPS: `curl -I https://your-domain.com`
- Create a room and establish a video call between two clients
- Confirm WebSocket connects over `wss://` and SFU signaling succeeds

## Notes
- For production security, `backend` and `streaming-node` ports are not published; Nginx proxies internally.
- The SFU expects `SECURITY_JWT_SECRET` (provided via `JWT_SECRET` in `.env`).
- If TLS termination is external (cloud LB), you can omit Let’s Encrypt mounts and ensure `X-Forwarded-Proto` headers are passed.
