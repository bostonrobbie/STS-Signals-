#!/bin/bash
# Setup cron job for daily S&P 500 benchmark updates

# Get the project directory
PROJECT_DIR="/home/ubuntu/intraday-dashboard"

# Create cron job (runs daily at midnight UTC)
CRON_JOB="0 0 * * * cd $PROJECT_DIR && /usr/bin/python3 scripts/update-benchmark.py >> logs/benchmark-update.log 2>&1"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -F "update-benchmark.py") && echo "Cron job already exists" && exit 0

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Cron job added successfully!"
echo "The benchmark will be updated daily at midnight UTC"
