# Benchmark Data Update Scripts

## Overview

This directory contains scripts for automatically updating S&P 500 benchmark data using yfinance.

## Files

- `update-benchmark.py`: Python script that fetches missing S&P 500 data and inserts into database
- `setup-cron.sh`: Shell script to set up daily cron job for automatic updates

## Manual Update

To manually update the benchmark data:

```bash
cd /home/ubuntu/intraday-dashboard
python3 scripts/update-benchmark.py
```

## Automatic Daily Updates

To set up automatic daily updates at midnight UTC:

```bash
cd /home/ubuntu/intraday-dashboard
./scripts/setup-cron.sh
```

This will create a cron job that runs daily at midnight UTC.

## How It Works

1. The script connects to the database using the `DATABASE_URL` environment variable
2. It finds the last date in the `benchmarks` table
3. It fetches missing data from yfinance (ticker: ^GSPC for S&P 500 index)
4. It converts prices to cents (multiply by 100) to match the database schema
5. It inserts/updates the data in the database

## Logs

Cron job logs are written to `/home/ubuntu/intraday-dashboard/logs/benchmark-update.log`

## Troubleshooting

If the script fails:

1. Check that `DATABASE_URL` environment variable is set
2. Check that yfinance and mysql-connector-python are installed:
   ```bash
   sudo pip3 install yfinance mysql-connector-python
   ```
3. Check the logs for error messages
4. Verify database connectivity

## Dependencies

- Python 3.11+
- yfinance
- mysql-connector-python

These are pre-installed in the Manus sandbox environment.
