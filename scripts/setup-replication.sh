#!/bin/bash

# Database Replication Setup Script
# This script automates the setup of MySQL master-slave replication

set -e

# Configuration
MASTER_HOST="${1:-localhost}"
MASTER_PORT="${2:-3306}"
SLAVE_HOST="${3:-localhost}"
SLAVE_PORT="${4:-3307}"
REPLICATION_USER="replication"
REPLICATION_PASSWORD="${5:-replication_password}"
DB_ROOT_PASSWORD="${6:-root_password}"

echo "=== MySQL Master-Slave Replication Setup ==="
echo "Master: $MASTER_HOST:$MASTER_PORT"
echo "Slave: $SLAVE_HOST:$SLAVE_PORT"

# Step 1: Configure Master
echo ""
echo "Step 1: Configuring Master..."

mysql -h $MASTER_HOST -P $MASTER_PORT -u root -p$DB_ROOT_PASSWORD <<EOF
-- Enable binary logging
SET GLOBAL binlog_format = 'ROW';

-- Create replication user
CREATE USER IF NOT EXISTS '$REPLICATION_USER'@'$SLAVE_HOST' IDENTIFIED BY '$REPLICATION_PASSWORD';
GRANT REPLICATION SLAVE ON *.* TO '$REPLICATION_USER'@'$SLAVE_HOST';
FLUSH PRIVILEGES;

-- Get master status
FLUSH MASTER;
SHOW MASTER STATUS;
EOF

# Get binary log file and position
MASTER_STATUS=$(mysql -h $MASTER_HOST -P $MASTER_PORT -u root -p$DB_ROOT_PASSWORD -e "SHOW MASTER STATUS\G" | grep -E "File|Position")
MASTER_LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
MASTER_LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

echo "Master Log File: $MASTER_LOG_FILE"
echo "Master Log Position: $MASTER_LOG_POS"

# Step 2: Backup Master Database
echo ""
echo "Step 2: Backing up Master database..."

BACKUP_FILE="/tmp/master_backup_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h $MASTER_HOST -P $MASTER_PORT -u root -p$DB_ROOT_PASSWORD \
  --all-databases --single-transaction --master-data=2 > $BACKUP_FILE

echo "Backup saved to: $BACKUP_FILE"

# Step 3: Restore Backup on Slave
echo ""
echo "Step 3: Restoring backup on Slave..."

mysql -h $SLAVE_HOST -P $SLAVE_PORT -u root -p$DB_ROOT_PASSWORD < $BACKUP_FILE

echo "Backup restored on Slave"

# Step 4: Configure Slave
echo ""
echo "Step 4: Configuring Slave..."

mysql -h $SLAVE_HOST -P $SLAVE_PORT -u root -p$DB_ROOT_PASSWORD <<EOF
-- Stop any existing replication
STOP SLAVE;
RESET SLAVE;

-- Configure replication
CHANGE MASTER TO
  MASTER_HOST = '$MASTER_HOST',
  MASTER_PORT = $MASTER_PORT,
  MASTER_USER = '$REPLICATION_USER',
  MASTER_PASSWORD = '$REPLICATION_PASSWORD',
  MASTER_LOG_FILE = '$MASTER_LOG_FILE',
  MASTER_LOG_POS = $MASTER_LOG_POS;

-- Start replication
START SLAVE;

-- Check replication status
SHOW SLAVE STATUS\G
EOF

# Step 5: Verify Replication
echo ""
echo "Step 5: Verifying replication..."

sleep 5

SLAVE_STATUS=$(mysql -h $SLAVE_HOST -P $SLAVE_PORT -u root -p$DB_ROOT_PASSWORD -e "SHOW SLAVE STATUS\G")

IO_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
SQL_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
SECONDS_BEHIND=$(echo "$SLAVE_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')

echo "Slave IO Running: $IO_RUNNING"
echo "Slave SQL Running: $SQL_RUNNING"
echo "Seconds Behind Master: $SECONDS_BEHIND"

if [ "$IO_RUNNING" = "Yes" ] && [ "$SQL_RUNNING" = "Yes" ]; then
  echo ""
  echo "✓ Replication setup successful!"
else
  echo ""
  echo "✗ Replication setup failed!"
  echo "Please check the error logs and try again."
  exit 1
fi

# Cleanup
rm $BACKUP_FILE

echo ""
echo "=== Setup Complete ==="
