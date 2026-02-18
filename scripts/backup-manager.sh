#!/bin/bash

# Backup Manager Script
# Automates database backups, verification, and S3 upload

set -e

# Configuration
BACKUP_DIR="/backups/mysql"
S3_BUCKET="s3://intraday-dashboard-backups"
RETENTION_DAYS=30
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_NAME="${DB_NAME:-intraday_dashboard}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory
mkdir -p $BACKUP_DIR

# Function: Create backup
create_backup() {
  log_info "Creating database backup..."
  
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
  BACKUP_COMPRESSED="$BACKUP_FILE.gz"
  
  # Create backup
  mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD \
    --all-databases \
    --single-transaction \
    --quick \
    --lock-tables=false \
    > $BACKUP_FILE
  
  if [ $? -ne 0 ]; then
    log_error "Failed to create backup"
    rm -f $BACKUP_FILE
    return 1
  fi
  
  # Compress backup
  gzip $BACKUP_FILE
  
  if [ $? -ne 0 ]; then
    log_error "Failed to compress backup"
    rm -f $BACKUP_FILE $BACKUP_COMPRESSED
    return 1
  fi
  
  # Get backup size
  BACKUP_SIZE=$(du -h $BACKUP_COMPRESSED | awk '{print $1}')
  log_info "Backup created: $BACKUP_COMPRESSED (Size: $BACKUP_SIZE)"
  
  echo $BACKUP_COMPRESSED
}

# Function: Verify backup
verify_backup() {
  local backup_file=$1
  
  log_info "Verifying backup integrity..."
  
  # Check if file exists
  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi
  
  # Check if file is valid gzip
  if ! gzip -t $backup_file 2>/dev/null; then
    log_error "Backup file is corrupted: $backup_file"
    return 1
  fi
  
  # Check if backup contains database dump
  if ! gunzip -c $backup_file | grep -q "CREATE TABLE"; then
    log_error "Backup does not contain valid database dump"
    return 1
  fi
  
  log_info "Backup verification passed"
  return 0
}

# Function: Upload to S3
upload_to_s3() {
  local backup_file=$1
  
  log_info "Uploading backup to S3..."
  
  # Check if AWS CLI is installed
  if ! command -v aws &> /dev/null; then
    log_warn "AWS CLI not installed, skipping S3 upload"
    return 0
  fi
  
  # Upload to S3
  aws s3 cp $backup_file $S3_BUCKET/$(basename $backup_file)
  
  if [ $? -ne 0 ]; then
    log_error "Failed to upload backup to S3"
    return 1
  fi
  
  log_info "Backup uploaded to S3"
  return 0
}

# Function: Cleanup old backups
cleanup_old_backups() {
  log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
  
  # Remove local backups older than retention period
  find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
  
  # Remove S3 backups older than retention period
  if command -v aws &> /dev/null; then
    aws s3 ls $S3_BUCKET/ | while read -r line; do
      DATE=$(echo $line | awk '{print $1}')
      FILE=$(echo $line | awk '{print $4}')
      
      # Calculate days old
      DAYS_OLD=$(( ($(date +%s) - $(date -d "$DATE" +%s)) / 86400 ))
      
      if [ $DAYS_OLD -gt $RETENTION_DAYS ]; then
        log_info "Deleting old backup: $FILE"
        aws s3 rm $S3_BUCKET/$FILE
      fi
    done
  fi
  
  log_info "Cleanup completed"
}

# Function: Restore backup
restore_backup() {
  local backup_file=$1
  
  log_info "Restoring backup from $backup_file..."
  
  # Check if file exists
  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi
  
  # Decompress and restore
  gunzip -c $backup_file | mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD
  
  if [ $? -ne 0 ]; then
    log_error "Failed to restore backup"
    return 1
  fi
  
  log_info "Backup restored successfully"
  return 0
}

# Function: List backups
list_backups() {
  log_info "Available backups:"
  
  echo ""
  echo "Local backups:"
  ls -lh $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}'
  
  if command -v aws &> /dev/null; then
    echo ""
    echo "S3 backups:"
    aws s3 ls $S3_BUCKET/ | awk '{print $4, "(" $3 " bytes)"}'
  fi
  
  echo ""
}

# Function: Test restore
test_restore() {
  log_info "Testing backup restoration..."
  
  # Get latest backup
  LATEST_BACKUP=$(ls -t $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | head -1)
  
  if [ -z "$LATEST_BACKUP" ]; then
    log_error "No backups found"
    return 1
  fi
  
  log_info "Testing restore of: $LATEST_BACKUP"
  
  # Create temporary database
  TEMP_DB="test_restore_$(date +%s)"
  
  # Decompress and restore to temp database
  gunzip -c $LATEST_BACKUP | mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "CREATE DATABASE $TEMP_DB"
  gunzip -c $LATEST_BACKUP | mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $TEMP_DB
  
  if [ $? -ne 0 ]; then
    log_error "Restore test failed"
    mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "DROP DATABASE $TEMP_DB"
    return 1
  fi
  
  # Verify data
  TABLE_COUNT=$(mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $TEMP_DB -e "SELECT COUNT(*) FROM information_schema.TABLES" | tail -1)
  
  log_info "Restore test successful. Tables found: $TABLE_COUNT"
  
  # Cleanup
  mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "DROP DATABASE $TEMP_DB"
  
  return 0
}

# Main function
main() {
  case "${1:-backup}" in
    backup)
      BACKUP_FILE=$(create_backup)
      if [ $? -eq 0 ]; then
        verify_backup $BACKUP_FILE
        if [ $? -eq 0 ]; then
          upload_to_s3 $BACKUP_FILE
          cleanup_old_backups
        fi
      fi
      ;;
    verify)
      LATEST_BACKUP=$(ls -t $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | head -1)
      if [ -z "$LATEST_BACKUP" ]; then
        log_error "No backups found"
        exit 1
      fi
      verify_backup $LATEST_BACKUP
      ;;
    restore)
      if [ -z "$2" ]; then
        log_error "Usage: $0 restore <backup_file>"
        exit 1
      fi
      restore_backup $2
      ;;
    list)
      list_backups
      ;;
    test)
      test_restore
      ;;
    *)
      echo "Usage: $0 {backup|verify|restore|list|test}"
      echo ""
      echo "Commands:"
      echo "  backup    - Create and upload backup"
      echo "  verify    - Verify latest backup"
      echo "  restore   - Restore from backup"
      echo "  list      - List available backups"
      echo "  test      - Test backup restoration"
      exit 1
      ;;
  esac
}

main "$@"
