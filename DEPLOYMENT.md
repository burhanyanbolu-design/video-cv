# Video CV API - Production Deployment Guide

## Overview
Deploy the Video CV API to AWS EC2 with Docker, PostgreSQL, Redis, and Nginx.

---

## Prerequisites

✅ AWS EC2 instance (Ubuntu) - **You already have this**
✅ Domain: hardinai.co.uk with DNS access
✅ Docker installed on EC2
✅ Nginx installed on EC2

---

## Step 1: Choose Subdomain

Pick one:
- `cv.hardinai.co.uk` (recommended)
- `video-cv.hardinai.co.uk`
- `api.hardinai.co.uk`

---

## Step 2: Prepare Environment Variables

Create `.env.production` file:

```bash
# Server
PORT=3003
NODE_ENV=production

# Database (PostgreSQL)
DATABASE_URL=postgresql://videocv:CHANGE_THIS_PASSWORD@localhost:5432/videocv_prod

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secret (generate new one for production)
JWT_SECRET=GENERATE_NEW_SECRET_HERE

# OpenAI API
OPENAI_API_KEY=your-production-openai-key

# AWS S3
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=video-cv-uploads-prod

# Privacy Policy
PRIVACY_POLICY_VERSION=1.0
```

---

## Step 3: Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm install --production --legacy-peer-deps

# Copy source code
COPY apps/api ./apps/api
COPY packages/types ./packages/types

# Build TypeScript
WORKDIR /app/apps/api
RUN npm run build

# Expose port
EXPOSE 3003

# Start server
CMD ["node", "dist/index.js"]
```

---

## Step 4: Create docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: videocv-postgres
    environment:
      POSTGRES_DB: videocv_prod
      POSTGRES_USER: videocv
      POSTGRES_PASSWORD: CHANGE_THIS_PASSWORD
    volumes:
      - videocv-postgres-data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    restart: always

  redis:
    image: redis:7-alpine
    container_name: videocv-redis
    ports:
      - "6380:6379"
    restart: always

  api:
    build: .
    container_name: videocv-api
    env_file:
      - .env.production
    ports:
      - "3003:3003"
    depends_on:
      - postgres
      - redis
    restart: always

volumes:
  videocv-postgres-data:
```

---

## Step 5: Setup on AWS EC2

### SSH into your server:
```bash
ssh ubuntu@your-ec2-ip
```

### Create project directory:
```bash
mkdir -p ~/video-cv-api
cd ~/video-cv-api
```

### Upload files to server:
From your local machine:
```bash
# Zip the project
cd client-projects/video-cv
tar -czf video-cv-api.tar.gz apps/api apps/web/package.json packages .env.production Dockerfile docker-compose.yml

# Upload to server (replace with your EC2 IP)
scp video-cv-api.tar.gz ubuntu@YOUR_EC2_IP:~/video-cv-api/

# SSH and extract
ssh ubuntu@YOUR_EC2_IP
cd ~/video-cv-api
tar -xzf video-cv-api.tar.gz
```

---

## Step 6: Run Database Migrations

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Wait 5 seconds for PostgreSQL to start
sleep 5

# Run migrations
docker exec -i videocv-postgres psql -U videocv -d videocv_prod < apps/api/migrations/001_create_users.sql
docker exec -i videocv-postgres psql -U videocv -d videocv_prod < apps/api/migrations/002_create_sessions.sql
docker exec -i videocv-postgres psql -U videocv -d videocv_prod < apps/api/migrations/003_create_profiles.sql
```

---

## Step 7: Start All Services

```bash
docker-compose up -d
```

Check logs:
```bash
docker-compose logs -f api
```

---

## Step 8: Configure Nginx

Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/video-cv
```

Paste this:
```nginx
server {
    listen 80;
    server_name cv.hardinai.co.uk;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/video-cv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 9: Setup SSL with Certbot

```bash
sudo certbot --nginx -d cv.hardinai.co.uk
```

---

## Step 10: Configure DNS

In your domain registrar (where you manage hardinai.co.uk):

Add A record:
- **Name:** `cv`
- **Type:** `A`
- **Value:** Your EC2 IP address
- **TTL:** 300

---

## Step 11: Test Production API

```bash
# Health check
curl https://cv.hardinai.co.uk/health

# Register test user
curl -X POST https://cv.hardinai.co.uk/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","privacyPolicyVersion":"1.0"}'
```

---

## Monitoring & Maintenance

### View logs:
```bash
docker-compose logs -f api
```

### Restart services:
```bash
docker-compose restart api
```

### Update code:
```bash
# Upload new code
# Extract
# Rebuild
docker-compose build api
docker-compose up -d api
```

### Backup database:
```bash
docker exec videocv-postgres pg_dump -U videocv videocv_prod > backup.sql
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate new JWT secret
- [ ] Use production OpenAI API key
- [ ] Setup firewall rules (only 80, 443, 22)
- [ ] Enable automatic security updates
- [ ] Setup monitoring/alerts
- [ ] Regular database backups

---

## Troubleshooting

### API not starting:
```bash
docker-compose logs api
```

### Database connection issues:
```bash
docker-compose logs postgres
docker exec -it videocv-postgres psql -U videocv -d videocv_prod
```

### Redis issues:
```bash
docker-compose logs redis
```

---

## Production URLs

- **API:** https://cv.hardinai.co.uk
- **Health:** https://cv.hardinai.co.uk/health
- **Docs:** https://cv.hardinai.co.uk/api-docs (if you add Swagger)

---

## Next Steps After Deployment

1. Test all endpoints
2. Upload test video
3. Monitor logs for errors
4. Setup monitoring (optional: PM2, DataDog, etc.)
5. Create API documentation
6. Build frontend UI

---

**Ready to deploy? Follow these steps one by one!** 🚀
