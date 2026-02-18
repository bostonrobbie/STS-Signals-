#!/usr/bin/env python3
"""
Fetch historical benchmark data for QQQ, IWM, GLD using Yahoo Finance API
and save to JSON files for database seeding
"""

import sys
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient
import json
from datetime import datetime, timedelta

def fetch_benchmark_data_by_year(symbol: str, year: int) -> list:
    """
    Fetch historical daily data for a benchmark symbol for a specific year
    """
    client = ApiClient()
    
    try:
        # Use period1 and period2 for specific date range
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31)
        
        # Convert to Unix timestamps
        period1 = int(start_date.timestamp())
        period2 = int(end_date.timestamp())
        
        response = client.call_api('YahooFinance/get_stock_chart', query={
            'symbol': symbol,
            'region': 'US',
            'interval': '1d',
            'range': '1y',  # 1 year of daily data
            'includeAdjustedClose': True
        })
        
        if response and 'chart' in response and 'result' in response['chart']:
            result = response['chart']['result'][0]
            timestamps = result['timestamp']
            quotes = result['indicators']['quote'][0]
            
            data = []
            for i in range(len(timestamps)):
                ts = timestamps[i]
                date = datetime.fromtimestamp(ts)
                
                # Skip if any price is None
                if quotes['open'][i] is None or quotes['close'][i] is None:
                    continue
                
                # Convert prices to cents (multiply by 100)
                data.append({
                    'symbol': symbol,
                    'date': date.strftime('%Y-%m-%d'),
                    'open': int(round(quotes['open'][i] * 100)),
                    'high': int(round(quotes['high'][i] * 100)),
                    'low': int(round(quotes['low'][i] * 100)),
                    'close': int(round(quotes['close'][i] * 100)),
                    'volume': quotes['volume'][i] if quotes['volume'][i] else 0
                })
            
            return data
        else:
            return []
            
    except Exception as e:
        print(f"  Error fetching data for {symbol} year {year}: {str(e)}")
        return []

def fetch_all_benchmark_data(symbol: str) -> list:
    """
    Fetch all available historical data for a benchmark symbol
    Uses multiple API calls with different ranges to get more data
    """
    client = ApiClient()
    
    print(f"Fetching data for {symbol}...")
    
    all_data = []
    
    # Try different range options to get more data
    ranges = ['10y', '5y', '2y', '1y']
    
    for range_opt in ranges:
        try:
            response = client.call_api('YahooFinance/get_stock_chart', query={
                'symbol': symbol,
                'region': 'US',
                'interval': '1d',
                'range': range_opt,
                'includeAdjustedClose': True
            })
            
            if response and 'chart' in response and 'result' in response['chart']:
                result = response['chart']['result'][0]
                timestamps = result['timestamp']
                quotes = result['indicators']['quote'][0]
                
                print(f"  Range {range_opt}: {len(timestamps)} data points")
                
                # If we got a good amount of data, use it
                if len(timestamps) > 200:
                    data = []
                    for i in range(len(timestamps)):
                        ts = timestamps[i]
                        date = datetime.fromtimestamp(ts)
                        
                        # Skip if any price is None
                        if quotes['open'][i] is None or quotes['close'][i] is None:
                            continue
                        
                        # Convert prices to cents (multiply by 100)
                        data.append({
                            'symbol': symbol,
                            'date': date.strftime('%Y-%m-%d'),
                            'open': int(round(quotes['open'][i] * 100)),
                            'high': int(round(quotes['high'][i] * 100)),
                            'low': int(round(quotes['low'][i] * 100)),
                            'close': int(round(quotes['close'][i] * 100)),
                            'volume': quotes['volume'][i] if quotes['volume'][i] else 0
                        })
                    
                    print(f"  Retrieved {len(data)} data points for {symbol}")
                    return data
                    
        except Exception as e:
            print(f"  Error with range {range_opt}: {str(e)}")
            continue
    
    print(f"  Could not get sufficient data for {symbol}")
    return []

def main():
    # Benchmarks to fetch
    benchmarks = ['QQQ', 'IWM', 'GLD']
    
    all_data = {}
    
    for symbol in benchmarks:
        data = fetch_all_benchmark_data(symbol)
        all_data[symbol] = data
    
    # Save to JSON file
    output_file = '/home/ubuntu/intraday-dashboard/scripts/benchmark-data.json'
    with open(output_file, 'w') as f:
        json.dump(all_data, f)
    
    print(f"\nData saved to {output_file}")
    
    # Print summary
    print("\nSummary:")
    for symbol, data in all_data.items():
        if data:
            print(f"  {symbol}: {len(data)} records ({data[0]['date']} to {data[-1]['date']})")
        else:
            print(f"  {symbol}: No data")

if __name__ == "__main__":
    main()
