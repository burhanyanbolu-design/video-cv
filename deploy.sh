#!/bin/bash

# Video CV API - Deployment Script
# Run this on your AWS EC2 server

set -e

echo "🚀 Video CV API - Deployment Script"
echo "===================================="

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production not found!"
    echo "Copy .env.production.example to .env.production and fill in your values"
    exit 1
fi

# Stop existing containers
echo "📦 Stopping existing containers..."
docker-compose down

# Build new image
echo "🔨 Building Docker image..."
docker-compose build

# Start PostgreSQL first
echo "🐘 Starting PostgreSQL..."
docker-compose up -d postgres
sleep 10

# Run migrations
echo "📊 Running database migrations..."
docker exec -i videocv-postgres psql -U videocv -d videocv_prod < apps/api/migrations/001_create_users.sql || true
docker exec -i videocv-postgres psql -U videocv -d videocv_prod < apps/api/migrations/002_create_sessions.sql || true
docker exec -i videocv-postgres psql -U videocv -d videocv_prod < apps/api/migrations/003_create_profiles.sql || true

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for API to be ready
echo "⏳ Waiting for API to be ready..."
sleep 5

# Check health
echo "🏥 Checking API health..."
curl -f http://localhost:3003/health || echo "⚠️  API health check failed"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f api"
echo ""
echo "🔍 Check status:"
echo "   docker-compose ps"
echo ""
echo "🌐 API URL: http://localhost:3003"
echo ""
