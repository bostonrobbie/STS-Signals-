#!/bin/bash

# System Health Check Script
# This script performs comprehensive health checks on the production system

set -e

# Configuration
APP_HOST="${1:-localhost}"
APP_PORT="${2:-3000}"
DB_HOST="${3:-localhost}"
DB_PORT="${4:-3306}"
REDIS_HOST="${5:-localhost}"
REDIS_PORT="${6:-6379}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0

# Helper functions
check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASSED=$((PASSED + 1))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  FAILED=$((FAILED + 1))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Application Health Checks
echo "=== Application Health Checks ==="

# Check application is running
if curl -s -f http://$APP_HOST:$APP_PORT/api/health &> /dev/null; then
  check_pass "Application is running"
else
  check_fail "Application is not responding"
fi

# Check API response time
START_TIME=$(date +%s%N)
curl -s -f http://$APP_HOST:$APP_PORT/api/health &> /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $RESPONSE_TIME -lt 500 ]; then
  check_pass "API response time: ${RESPONSE_TIME}ms"
else
  check_warn "API response time: ${RESPONSE_TIME}ms (target: <500ms)"
fi

# Check public API
if curl -s -f http://$APP_HOST:$APP_PORT/api/trpc/publicApi.listStrategies &> /dev/null; then
  check_pass "Public API is responding"
else
  check_fail "Public API is not responding"
fi

# Database Health Checks
echo ""
echo "=== Database Health Checks ==="

# Check database connectivity
if mysql -h $DB_HOST -P $DB_PORT -e "SELECT 1" &> /dev/null; then
  check_pass "Database is accessible"
else
  check_fail "Database is not accessible"
fi

# Check database size
DB_SIZE=$(mysql -h $DB_HOST -P $DB_PORT -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.TABLES WHERE table_schema = 'intraday_dashboard';" 2>/dev/null | tail -1)

if [ ! -z "$DB_SIZE" ]; then
  check_pass "Database size: ${DB_SIZE}MB"
else
  check_fail "Could not determine database size"
fi

# Check database replication status
SLAVE_STATUS=$(mysql -h $DB_HOST -P $DB_PORT -e "SHOW SLAVE STATUS\G" 2>/dev/null)

if [ ! -z "$SLAVE_STATUS" ]; then
  IO_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
  SQL_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
  SECONDS_BEHIND=$(echo "$SLAVE_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')
  
  if [ "$IO_RUNNING" = "Yes" ] && [ "$SQL_RUNNING" = "Yes" ]; then
    check_pass "Database replication is running (lag: ${SECONDS_BEHIND}s)"
  else
    check_fail "Database replication is not running"
  fi
else
  check_warn "Database replication status not available"
fi

# Check slow query log
SLOW_QUERIES=$(mysql -h $DB_HOST -P $DB_PORT -e "SELECT COUNT(*) FROM mysql.slow_log;" 2>/dev/null | tail -1)

if [ "$SLOW_QUERIES" -gt 0 ]; then
  check_warn "Slow queries detected: $SLOW_QUERIES"
else
  check_pass "No slow queries detected"
fi

# Redis Health Checks
echo ""
echo "=== Redis Health Checks ==="

# Check Redis connectivity
if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping &> /dev/null; then
  check_pass "Redis is accessible"
else
  check_fail "Redis is not accessible"
fi

# Check Redis memory usage
REDIS_MEMORY=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT INFO memory | grep used_memory_human | awk -F: '{print $2}' | tr -d '\r')

if [ ! -z "$REDIS_MEMORY" ]; then
  check_pass "Redis memory usage: $REDIS_MEMORY"
else
  check_fail "Could not determine Redis memory usage"
fi

# Check Redis key count
REDIS_KEYS=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT DBSIZE | awk '{print $2}')

if [ ! -z "$REDIS_KEYS" ]; then
  check_pass "Redis keys: $REDIS_KEYS"
else
  check_fail "Could not determine Redis key count"
fi

# System Health Checks
echo ""
echo "=== System Health Checks ==="

# Check disk usage
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')

if [ $DISK_USAGE -lt 80 ]; then
  check_pass "Disk usage: ${DISK_USAGE}%"
else
  check_warn "Disk usage: ${DISK_USAGE}% (warning: >80%)"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')

if [ $MEMORY_USAGE -lt 80 ]; then
  check_pass "Memory usage: ${MEMORY_USAGE}%"
else
  check_warn "Memory usage: ${MEMORY_USAGE}% (warning: >80%)"
fi

# Check CPU load
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')

check_pass "CPU load average: $CPU_LOAD"

# Check system uptime
UPTIME=$(uptime -p)

check_pass "System uptime: $UPTIME"

# Summary
echo ""
echo "=== Health Check Summary ==="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All health checks passed${NC}"
  exit 0
else
  echo -e "${RED}✗ Some health checks failed${NC}"
  exit 1
fi
