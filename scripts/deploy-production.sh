#!/bin/bash

# Production Deployment Script
# This script automates the deployment of the Intraday Dashboard to production

set -e

# Configuration
DEPLOYMENT_ENV="${1:-production}"
DOCKER_REGISTRY="${2:-docker.io}"
IMAGE_NAME="${3:-intraday-dashboard}"
IMAGE_TAG="${4:-latest}"
DEPLOYMENT_TIMEOUT="${5:-300}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
pre_deployment_checks() {
  log_info "Running pre-deployment checks..."
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi
  
  # Check docker-compose
  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed"
    exit 1
  fi
  
  # Check environment file
  if [ ! -f ".env.$DEPLOYMENT_ENV" ]; then
    log_error "Environment file .env.$DEPLOYMENT_ENV not found"
    exit 1
  fi
  
  # Check database connectivity
  log_info "Checking database connectivity..."
  source .env.$DEPLOYMENT_ENV
  
  if ! mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "SELECT 1" &> /dev/null; then
    log_error "Cannot connect to database"
    exit 1
  fi
  
  log_info "Pre-deployment checks passed"
}

# Build Docker image
build_image() {
  log_info "Building Docker image..."
  
  docker build -t $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG .
  
  if [ $? -eq 0 ]; then
    log_info "Docker image built successfully"
  else
    log_error "Failed to build Docker image"
    exit 1
  fi
}

# Push Docker image
push_image() {
  log_info "Pushing Docker image to registry..."
  
  docker push $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG
  
  if [ $? -eq 0 ]; then
    log_info "Docker image pushed successfully"
  else
    log_error "Failed to push Docker image"
    exit 1
  fi
}

# Create backup
create_backup() {
  log_info "Creating database backup..."
  
  source .env.$DEPLOYMENT_ENV
  
  BACKUP_DIR="/backups/mysql"
  BACKUP_FILE="$BACKUP_DIR/pre-deployment-$(date +%Y%m%d-%H%M%S).sql.gz"
  
  mkdir -p $BACKUP_DIR
  
  mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD \
    --all-databases --single-transaction | gzip > $BACKUP_FILE
  
  log_info "Database backup created: $BACKUP_FILE"
}

# Deploy using docker-compose
deploy_docker_compose() {
  log_info "Deploying application using docker-compose..."
  
  # Stop current containers
  log_info "Stopping current containers..."
  docker-compose -f docker-compose.production.yml down || true
  
  # Start new containers
  log_info "Starting new containers..."
  docker-compose -f docker-compose.production.yml up -d
  
  if [ $? -eq 0 ]; then
    log_info "Containers started successfully"
  else
    log_error "Failed to start containers"
    exit 1
  fi
}

# Wait for application to be ready
wait_for_ready() {
  log_info "Waiting for application to be ready..."
  
  ELAPSED=0
  while [ $ELAPSED -lt $DEPLOYMENT_TIMEOUT ]; do
    if curl -f http://localhost:3000/api/health &> /dev/null; then
      log_info "Application is ready"
      return 0
    fi
    
    sleep 5
    ELAPSED=$((ELAPSED + 5))
  done
  
  log_error "Application did not become ready within $DEPLOYMENT_TIMEOUT seconds"
  return 1
}

# Run smoke tests
run_smoke_tests() {
  log_info "Running smoke tests..."
  
  # Test health endpoint
  if ! curl -f http://localhost:3000/api/health &> /dev/null; then
    log_error "Health check failed"
    return 1
  fi
  
  # Test public API
  if ! curl -f http://localhost:3000/api/trpc/publicApi.listStrategies &> /dev/null; then
    log_error "Public API test failed"
    return 1
  fi
  
  log_info "Smoke tests passed"
  return 0
}

# Rollback deployment
rollback_deployment() {
  log_warn "Rolling back deployment..."
  
  # Restore previous containers
  docker-compose -f docker-compose.production.yml down || true
  docker-compose -f docker-compose.production.yml up -d
  
  log_info "Rollback complete"
}

# Main deployment flow
main() {
  log_info "Starting deployment to $DEPLOYMENT_ENV"
  log_info "Image: $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
  
  # Pre-deployment checks
  pre_deployment_checks
  
  # Create backup
  create_backup
  
  # Build image
  build_image
  
  # Push image
  push_image
  
  # Deploy
  deploy_docker_compose
  
  # Wait for ready
  if ! wait_for_ready; then
    log_error "Application failed to become ready"
    rollback_deployment
    exit 1
  fi
  
  # Run smoke tests
  if ! run_smoke_tests; then
    log_error "Smoke tests failed"
    rollback_deployment
    exit 1
  fi
  
  log_info "Deployment to $DEPLOYMENT_ENV completed successfully"
  
  # Post-deployment information
  echo ""
  echo "=== Deployment Summary ==="
  echo "Environment: $DEPLOYMENT_ENV"
  echo "Image: $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
  echo "Deployment Time: $(date)"
  echo "Application URL: http://localhost:3000"
  echo "Monitoring URL: http://localhost:3001 (Grafana)"
  echo ""
  echo "Next steps:"
  echo "1. Verify application functionality"
  echo "2. Monitor application metrics"
  echo "3. Check application logs: docker logs intraday-dashboard"
  echo "4. Run integration tests"
  echo ""
}

# Run main function
main "$@"
