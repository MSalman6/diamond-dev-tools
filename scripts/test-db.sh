#!/bin/bash
# Database connection test script
set -e

echo "🔍 Testing Database Connection"
echo "============================="

# Load environment variables
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Set defaults if not provided
DMD_DB_POSTGRES=${DMD_DB_POSTGRES:-"postgres"}
DMD_DB_POSTGRES_PORT=${DMD_DB_POSTGRES_PORT:-"5435"}

echo "📋 Configuration:"
echo "   Host: 127.0.0.1"
echo "   Port: $DMD_DB_POSTGRES_PORT" 
echo "   Database: postgres"
echo "   User: postgres"
echo ""

# Test 1: Basic connection
echo "1. Testing basic connection..."
if PGPASSWORD=$DMD_DB_POSTGRES psql -h 127.0.0.1 -p $DMD_DB_POSTGRES_PORT -U postgres -d postgres -c "SELECT current_timestamp;" >/dev/null 2>&1; then
    echo "   ✅ Basic connection successful"
else
    echo "   ❌ Basic connection failed"
    exit 1
fi

# Test 2: Check required tables
echo "2. Checking required tables..."
tables=("node" "headers" "bonus_score_history" "bonus_score_change_reasons")
for table in "${tables[@]}"; do
    if PGPASSWORD=$DMD_DB_POSTGRES psql -h 127.0.0.1 -p $DMD_DB_POSTGRES_PORT -U postgres -d postgres -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
        echo "   ✅ Table '$table' exists and accessible"
    else
        echo "   ❌ Table '$table' missing or inaccessible"
        exit 1
    fi
done

# Test 3: Check database permissions
echo "3. Testing write permissions..."
if PGPASSWORD=$DMD_DB_POSTGRES psql -h 127.0.0.1 -p $DMD_DB_POSTGRES_PORT -U postgres -d postgres -c "CREATE TEMP TABLE test_write (id INTEGER);" >/dev/null 2>&1; then
    echo "   ✅ Write permissions OK"
else
    echo "   ❌ Write permissions failed"
    exit 1
fi

# Test 4: Check bonus score system readiness
echo "4. Testing bonus score system readiness..."
bonus_tables=("bonus_score_history" "bonus_score_change_reasons")
for table in "${bonus_tables[@]}"; do
    count=$(PGPASSWORD=$DMD_DB_POSTGRES psql -h 127.0.0.1 -p $DMD_DB_POSTGRES_PORT -U postgres -d postgres -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    if [ $? -eq 0 ]; then
        echo "   ✅ Bonus score table '$table' ready (${count} records)"
    else
        echo "   ❌ Bonus score table '$table' not ready"
        exit 1
    fi
done

echo ""
echo "🎉 All database connection tests passed!"
echo ""
echo "🔗 Connection string: postgres://postgres:***@127.0.0.1:$DMD_DB_POSTGRES_PORT/postgres"
echo ""
