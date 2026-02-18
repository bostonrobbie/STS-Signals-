#!/usr/bin/env python3
"""
Normalize SPX Futures benchmark data into the format expected by the database.

Input: SPX_Futures_daily_ohlc.csv
Output: spy_benchmark.csv (using SPX as the benchmark)
"""

import csv
from datetime import datetime
from pathlib import Path

def parse_date(date_str):
    """Parse date string."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        print(f"Warning: Could not parse date: {date_str}")
        return None

def main():
    input_file = Path("/home/ubuntu/upload/SPX_Futures_daily_ohlc.csv")
    output_dir = Path("/home/ubuntu/Manus-Dashboard/data/seed")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "spy_benchmark.csv"
    
    print(f"Processing {input_file}...")
    
    benchmark_data = []
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
        for line in lines[2:]:
            parts = line.strip().split(',')
            if len(parts) < 6:
                continue
            
            date_str, open_price, high_price, low_price, close_price, volume = parts
            date = parse_date(date_str)
            if not date:
                continue
            
            try:
                benchmark_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'symbol': 'SPX',
                    'open': float(open_price),
                    'high': float(high_price),
                    'low': float(low_price),
                    'close': float(close_price),
                    'volume': int(float(volume))
                })
            except ValueError:
                print(f"Warning: Could not parse values for date {date_str}")
                continue
    
    print(f"Writing {len(benchmark_data)} rows to {output_file}...")
    with open(output_file, 'w', newline='') as f:
        fieldnames = ['date', 'symbol', 'open', 'high', 'low', 'close', 'volume']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(benchmark_data)
    print(f"✓ Created {output_file}")

if __name__ == "__main__":
    main()
