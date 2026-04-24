# Video CV - Testing Guide

## Project Overview

**Video CV** is a monorepo application that turns spoken recordings into cleaned videos and formatted CVs.

### Architecture
- **API** (Node.js + Express): Backend with video processing, AI, job queues
- **Web** (Next.js): Frontend web application
- **Mobile** (React Native/Expo): Mobile application
- **Packages**: Shared types, config, API client

### Tech Stack
- **Backend**: Express, PostgreSQL, Redis, BullMQ, OpenAI, AWS S3, Elasticsearch
- **Video Processing**: FFmpeg, Puppeteer
- **Frontend**: Next.js, React Native
- **Infrastructure**: AWS, Docker

---

## Prerequisites

### Required Software
- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL
- Redis
- FFmpeg
- Docker (optional)

### Environment Variables
Create `.env` files in each app directory.

---

## Quick Start Testing

### 1. Install Dependencies
```bash
cd client-projects/video-cv
npm install
```

### 2. Run All Tests
```bash
npm test
```

### 3. Run Development Servers
```bash
npm run dev
```

This starts:
- API: http://localhost:3001
- Web: http://localhost:3000
- Mobile: Expo dev server

---

## Detailed Testing

### Phase 1: API Testing

#### 1.1 Setup API Environment

Create `apps/api/.env`:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/video_cv
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=video_cv
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=video-cv-uploads

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
```

#### 1.2 Start Required Services

**PostgreSQL:**
```bash
# Using Docker
docker run -d --name video-cv-postgres \
  -e POSTGRES_DB=video_cv \
  -e POSTGRES_USER=your_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15
```

**Redis:**
```bash
# Using Docker
docker run -d --name video-cv-redis \
  -p 6379:6379 \
  redis:7-alpine
```

**Elasticsearch (optional):**
```bash
# Using Docker
docker run -d --name video-cv-elasticsearch \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -p 9200:9200 \
  elasticsearch:8.13.0
```

#### 1.3 Run API Tests

```bash
cd apps/api
npm test
```

#### 1.4 Start API Development Server

```bash
cd apps/api
npm run dev
```

API should be running on http://localhost:3001

#### 1.5 Test API Endpoints

**Health Check:**
```bash
curl http://localhost:3001/health
```

**User Registration:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User"
  }'
```

**User Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

**Upload Video (with auth token):**
```bash
curl -X POST http://localhost:3001/api/videos/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "video=@/path/to/video.mp4"
```

---

### Phase 2: Web App Testing

#### 2.1 Setup Web Environment

Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

#### 2.2 Run Web Tests

```bash
cd apps/web
npm test
```

#### 2.3 Start Web Development Server

```bash
cd apps/web
npm run dev
```

Web app should be running on http://localhost:3000

#### 2.4 Manual Web Testing

**Test Scenarios:**

1. **User Registration**
   - Go to http://localhost:3000/register
   - Fill in email, password, name
   - Submit form
   - Verify success message
   - Check email for verification (if implemented)

2. **User Login**
   - Go to http://localhost:3000/login
   - Enter credentials
   - Submit form
   - Verify redirect to dashboard

3. **Video Upload**
   - Log in
   - Go to upload page
   - Select video file
   - Upload
   - Verify progress indicator
   - Check upload success

4. **Video Processing**
   - After upload, check processing status
   - Verify real-time updates (WebSocket)
   - Check processed video appears

5. **CV Generation**
   - View processed video
   - Click "Generate CV"
   - Verify CV is generated
   - Download CV
   - Check formatting

6. **Profile Management**
   - Go to profile page
   - Update information
   - Save changes
   - Verify updates persist

---

### Phase 3: Mobile App Testing

#### 3.1 Setup Mobile Environment

Create `apps/mobile/.env`:
```env
API_URL=http://localhost:3001
WS_URL=ws://localhost:3001
```

#### 3.2 Start Mobile Development

```bash
cd apps/mobile
npm run dev
```

This starts Expo dev server.

#### 3.3 Test on Device/Emulator

**iOS Simulator:**
- Press `i` in terminal
- Or scan QR code with Expo Go app

**Android Emulator:**
- Press `a` in terminal
- Or scan QR code with Expo Go app

**Physical Device:**
- Install Expo Go app
- Scan QR code

#### 3.4 Mobile Test Scenarios

1. **App Launch**
   - App opens without crashes
   - Splash screen displays
   - Navigates to login/home

2. **Authentication**
   - Register new account
   - Login with credentials
   - Logout functionality

3. **Video Recording**
   - Open camera
   - Record video
   - Preview recording
   - Upload video

4. **Video Library**
   - View uploaded videos
   - Play videos
   - Delete videos

5. **CV Viewing**
   - View generated CVs
   - Download CVs
   - Share CVs

---

## Integration Testing

### Test Complete User Flow

1. **Register Account** (Web or Mobile)
2. **Login** (Web or Mobile)
3. **Upload/Record Video** (Web or Mobile)
4. **Wait for Processing** (Check WebSocket updates)
5. **View Processed Video** (Web or Mobile)
6. **Generate CV** (Web or Mobile)
7. **Download CV** (Web or Mobile)
8. **Share CV** (Mobile)

---

## Performance Testing

### API Load Testing

Using Apache Bench:
```bash
# Test health endpoint
ab -n 1000 -c 10 http://localhost:3001/health

# Test authenticated endpoint (with token)
ab -n 100 -c 5 -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/videos
```

### Video Processing Performance

Test with different video sizes:
- Small: < 10MB
- Medium: 10-50MB
- Large: 50-100MB
- Very Large: > 100MB

Measure:
- Upload time
- Processing time
- Download time

---

## Security Testing

### Authentication Tests

1. **Test without token:**
   ```bash
   curl http://localhost:3001/api/videos
   # Should return 401 Unauthorized
   ```

2. **Test with invalid token:**
   ```bash
   curl -H "Authorization: Bearer invalid_token" \
     http://localhost:3001/api/videos
   # Should return 401 Unauthorized
   ```

3. **Test with expired token:**
   - Use old token
   - Should return 401 Unauthorized

### Input Validation Tests

1. **SQL Injection:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com OR 1=1--","password":"test"}'
   # Should be sanitized
   ```

2. **XSS:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","name":"<script>alert(1)</script>"}'
   # Should be escaped
   ```

3. **File Upload:**
   - Try uploading non-video files
   - Try uploading very large files
   - Try uploading malicious files

---

## Error Handling Testing

### Test Error Scenarios

1. **Database Down:**
   - Stop PostgreSQL
   - Try API requests
   - Should return 503 Service Unavailable

2. **Redis Down:**
   - Stop Redis
   - Try job-dependent operations
   - Should handle gracefully

3. **S3 Unavailable:**
   - Use invalid AWS credentials
   - Try upload
   - Should return appropriate error

4. **OpenAI API Error:**
   - Use invalid API key
   - Try CV generation
   - Should handle gracefully

---

## Automated Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- apps/api/src/services/video.test.ts
```

### Integration Tests

```bash
# Run integration tests
npm test -- --run integration
```

### E2E Tests (if implemented)

```bash
# Run end-to-end tests
npm run test:e2e
```

---

## Monitoring & Logging

### Check Logs

**API Logs:**
```bash
cd apps/api
npm run dev
# Watch console output
```

**Job Queue Logs:**
- Check BullMQ dashboard (if configured)
- Monitor Redis for job status

**Database Logs:**
```bash
# PostgreSQL logs
docker logs video-cv-postgres

# Check active connections
psql -U your_user -d video_cv -c "SELECT * FROM pg_stat_activity;"
```

---

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find process using port
lsof -i :3001
# Kill process
kill -9 <PID>
```

**Database Connection Error:**
- Check PostgreSQL is running
- Verify credentials in .env
- Check DATABASE_URL format

**Redis Connection Error:**
- Check Redis is running
- Verify REDIS_HOST and REDIS_PORT

**FFmpeg Not Found:**
```bash
# Install FFmpeg
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg

# Windows
# Download from ffmpeg.org
```

**OpenAI API Error:**
- Verify API key is valid
- Check API quota/limits
- Ensure billing is set up

---

## Deployment Testing

### Build for Production

```bash
# Build all apps
npm run build

# Test production build
cd apps/api
npm start
```

### Docker Testing

```bash
# Build Docker image
docker build -t video-cv-api -f apps/api/Dockerfile .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_HOST=redis \
  video-cv-api
```

---

## Test Checklist

### Before Deployment

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing completed
- [ ] Security tests passed
- [ ] Performance acceptable
- [ ] Error handling verified
- [ ] Logs reviewed
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] S3 bucket configured
- [ ] Redis configured
- [ ] OpenAI API key valid
- [ ] SSL certificates installed (production)
- [ ] Monitoring set up
- [ ] Backups configured

---

## Performance Benchmarks

### Expected Performance

- **API Response Time**: < 200ms
- **Video Upload**: Depends on size and network
- **Video Processing**: 1-5 minutes (depends on length)
- **CV Generation**: 10-30 seconds
- **Database Queries**: < 50ms
- **WebSocket Latency**: < 100ms

---

## Support

### Getting Help

- Check logs first
- Review error messages
- Test individual components
- Verify environment variables
- Check service status (DB, Redis, etc.)

---

**Last Updated:** April 22, 2026  
**Project Version:** 1.0.0  
**Status:** Ready for Testing ✅
