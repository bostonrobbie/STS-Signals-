#!/usr/bin/env python3
"""
Update S&P 500 benchmark data using yfinance
Fetches missing data and inserts into database
"""

import yfinance as yf
import mysql.connector
from datetime import datetime, timedelta
import os
import sys

# Database connection from environment
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set")
    sys.exit(1)

# Parse DATABASE_URL: mysql://user:password@host:port/database
# Format: mysql://username:password@host:port/database
try:
    parts = DATABASE_URL.replace('mysql://', '').split('@')
    user_pass = parts[0].split(':')
    host_db = parts[1].split('/')
    host_port = host_db[0].split(':')
    
    db_config = {
        'user': user_pass[0],
        'password': user_pass[1],
        'host': host_port[0],
        'port': int(host_port[1]) if len(host_port) > 1 else 3306,
        'database': host_db[1].split('?')[0],  # Remove query params
    }
except Exception as e:
    print(f"ERROR: Failed to parse DATABASE_URL: {e}")
    sys.exit(1)

def get_last_benchmark_date(cursor):
    """Get the last date in the benchmarks table"""
    cursor.execute("SELECT MAX(date) FROM benchmarks")
    result = cursor.fetchone()
    return result[0] if result and result[0] else None

def fetch_sp500_data(start_date, end_date):
    """Fetch S&P 500 data from yfinance"""
    # Use ^GSPC for S&P 500 index (more reliable than ES futures)
    ticker = yf.Ticker("^GSPC")
    
    # Fetch historical data
    hist = ticker.history(start=start_date, end=end_date)
    
    return hist

def insert_benchmark_data(cursor, data):
    """Insert benchmark data into database"""
    insert_query = """
    INSERT INTO benchmarks (date, open, high, low, close, volume)
    VALUES (%s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        open = VALUES(open),
        high = VALUES(high),
        low = VALUES(low),
        close = VALUES(close),
        volume = VALUES(volume)
    """
    
    rows_inserted = 0
    for index, row in data.iterrows():
        date = index.date()
        # Convert prices to cents (multiply by 100)
        # Volume: cap at INT max (2147483647) to avoid overflow
        volume = int(row['Volume'])
        if volume > 2147483647:
            volume = 2147483647
        
        cursor.execute(insert_query, (
            date,
            int(row['Open'] * 100),  # Convert to cents
            int(row['High'] * 100),  # Convert to cents
            int(row['Low'] * 100),   # Convert to cents
            int(row['Close'] * 100), # Convert to cents
            volume
        ))
        rows_inserted += 1
    
    return rows_inserted

def main():
    print(f"[{datetime.now().isoformat()}] Starting S&P 500 benchmark update...")
    
    try:
        # Connect to database
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Get last date in database
        last_date = get_last_benchmark_date(cursor)
        
        if last_date:
            # Fetch from day after last date to today
            start_date = last_date + timedelta(days=1)
            print(f"Last benchmark date in DB: {last_date}")
        else:
            # No data yet, fetch from 5 years ago
            start_date = datetime.now() - timedelta(days=5*365)
            print("No benchmark data found, fetching last 5 years")
        
        end_date = datetime.now()
        
        if start_date >= end_date:
            print("Database is already up to date!")
            return
        
        print(f"Fetching S&P 500 data from {start_date.date()} to {end_date.date()}...")
        
        # Fetch data from yfinance
        data = fetch_sp500_data(start_date, end_date)
        
        if data.empty:
            print("No new data available from yfinance")
            return
        
        print(f"Fetched {len(data)} rows from yfinance")
        
        # Insert into database
        rows_inserted = insert_benchmark_data(cursor, data)
        conn.commit()
        
        print(f"Successfully inserted/updated {rows_inserted} benchmark rows")
        print(f"[{datetime.now().isoformat()}] Benchmark update complete!")
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()
