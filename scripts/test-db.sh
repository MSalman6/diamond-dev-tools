#!/bin/bash
# Consolidates all database setup functionality
set -e

echo "🚀 Database Fresh Setup"
echo "======================"

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Load environment variables if they exist
if [ -f ".env" ]; then
    echo "📋 Loading environment variables..."
    set -a
    source .env
    set +a
    echo "✅ Environment variables loaded"
fi

# Verify environment variables are set
if [ -z "$DMD_DB_POSTGRES" ] || [ -z "$DMD_DB_POSTGRES_PASS" ] || [ -z "$DMD_DB_POSTGRES_PORT" ]; then
    echo "⚠️  Environment variables not set. Setting defaults..."
    export DMD_DB_POSTGRES=${DMD_DB_POSTGRES:-"postgres"}
    export DMD_DB_POSTGRES_PASS=${DMD_DB_POSTGRES_PASS:-"postgres"}
    export DMD_DB_POSTGRES_PORT=${DMD_DB_POSTGRES_PORT:-"5435"}
    echo "✅ Using defaults: DMD_DB_POSTGRES=$DMD_DB_POSTGRES, DMD_DB_POSTGRES_PORT=$DMD_DB_POSTGRES_PORT"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
cd db
docker compose -f docker-compose-persistent.yml down || true

# Start fresh containers
echo "🚀 Starting fresh database containers..."
envsubst < grafana/templates/postgres.yaml > grafana/provisioning/datasources/postgres.yaml
docker compose -f docker-compose-persistent.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is responding with connection test
echo "🔍 Checking database connectivity..."
for i in {1..30}; do
    if docker compose -f docker-compose-persistent.yml exec -T db pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database failed to start after 5 minutes"
        exit 1
    fi
    echo "   Attempt $i/30: Database not ready yet, waiting..."
    sleep 10
done

# Apply migrations
echo "📝 Applying database migrations..."
cd ..
sleep 3
./scripts/apply-migrations.sh

echo ""
echo "🎉 Database fresh setup completed successfully!"
echo ""
echo "🚀 Next steps:"
echo "   npm run db-fill-from-network    # Fill database from network"
echo "   npm run test-db                 # Test database connection"
echo ""