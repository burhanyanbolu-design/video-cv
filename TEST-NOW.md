# Quick Test - Video CV

## Start Testing Now

### 1. Install Dependencies (if not done)
```bash
cd client-projects/video-cv
npm install
```

### 2. Start Services

**Option A: Using Docker (Recommended)**
```bash
# Start PostgreSQL
docker run -d --name video-cv-postgres -e POSTGRES_DB=video_cv -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin123 -p 5432:5432 postgres:15

# Start Redis
docker run -d --name video-cv-redis -p 6379:6379 redis:7-alpine
```

**Option B: Local Services**
- Ensure PostgreSQL is running on port 5432
- Ensure Redis is running on port 6379

### 3. Setup Environment Variables

**API (.env):**
```bash
# Create apps/api/.env
cat > apps/api/.env << 'EOF'
DATABASE_URL=postgresql://admin:admin123@localhost:5432/video_cv
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=video_cv
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123

REDIS_HOST=localhost
REDIS_PORT=6379

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET_NAME=video-cv-test

OPENAI_API_KEY=sk-test-key

JWT_SECRET=test-secret-key-change-in-production
JWT_EXPIRES_IN=7d

PORT=3001
NODE_ENV=development
EOF
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Or test individual apps
cd apps/api && npm test
cd apps/web && npm test
```

### 5. Start Development Servers

```bash
# Start all apps
npm run dev
```

This will start:
- API: http://localhost:3001
- Web: http://localhost:3000
- Mobile: Expo dev server

### 6. Quick API Test

```bash
# Health check
curl http://localhost:3001/health

# Should return: {"status":"ok"}
```

### 7. Test Web App

Open browser: http://localhost:3000

Test:
- Registration page works
- Login page works
- Upload page accessible

---

## Troubleshooting

**Turbo error:**
```bash
# Clear turbo cache
npx turbo clean
npm install
```

**Port in use:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3001
kill -9 <PID>
```

**Database connection error:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Restart if needed
docker restart video-cv-postgres
```

**Redis connection error:**
```bash
# Check Redis is running
docker ps | grep redis

# Restart if needed
docker restart video-cv-redis
```

---

## What to Test

### Critical Features
1. ✅ User registration
2. ✅ User login
3. ✅ Video upload
4. ✅ Video processing
5. ✅ CV generation
6. ✅ CV download

### API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/videos/upload
- GET /api/videos
- GET /api/videos/:id
- POST /api/cv/generate
- GET /api/cv/:id

### WebSocket
- Real-time processing updates
- Job status notifications

---

## Next Steps

After basic testing:
1. Review TESTING-GUIDE.md for comprehensive tests
2. Test security (authentication, authorization)
3. Test error handling
4. Performance testing
5. Mobile app testing

---

**Ready to deploy?** Check the full TESTING-GUIDE.md
