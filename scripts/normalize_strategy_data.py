#!/usr/bin/env python3
"""
Normalize uploaded strategy CSV files into the format expected by the database schema.

Input: Raw TradingView strategy export CSVs
Output: Normalized trades.csv and strategies.csv for database seeding
"""

import csv
import json
from datetime import datetime
from pathlib import Path
import sys

# Strategy metadata mapping
STRATEGY_METADATA = {
    "ESTrend": {
        "name": "ES Trend",
        "description": "S&P 500 E-mini futures trend following strategy",
        "symbol": "ES",
        "type": "intraday"
    },
    "ESORB": {
        "name": "ES Opening Range Breakout",
        "description": "S&P 500 E-mini futures opening range breakout strategy",
        "symbol": "ES",
        "type": "intraday"
    },
    "NQTrend": {
        "name": "NQ Trend",
        "description": "NASDAQ-100 E-mini futures trend following strategy",
        "symbol": "NQ",
        "type": "intraday"
    },
    "NQORB": {
        "name": "NQ Opening Range Breakout",
        "description": "NASDAQ-100 E-mini futures opening range breakout strategy",
        "symbol": "NQ",
        "type": "intraday"
    },
    "CLTrend": {
        "name": "CL Trend",
        "description": "Crude Oil futures trend following strategy",
        "symbol": "CL",
        "type": "intraday"
    },
    "BTCTrend": {
        "name": "BTC Trend",
        "description": "Bitcoin futures trend following strategy",
        "symbol": "BTC",
        "type": "intraday"
    },
    "GCTrend": {
        "name": "GC Trend",
        "description": "Gold futures trend following strategy",
        "symbol": "GC",
        "type": "intraday"
    },
    "YMORB": {
        "name": "YM Opening Range Breakout",
        "description": "Dow Jones E-mini futures opening range breakout strategy",
        "symbol": "YM",
        "type": "intraday"
    }
}

def parse_datetime(dt_str):
    """Parse datetime string from TradingView format."""
    try:
        # Try format: "2010-11-04 16:50"
        return datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    except ValueError:
        try:
            # Try format: "2010-11-04 16:50:00"
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            print(f"Warning: Could not parse datetime: {dt_str}")
            return None

def extract_strategy_name(filename):
    """Extract strategy name from filename (e.g., 'ESTrend.csv' -> 'ESTrend')."""
    return Path(filename).stem

def normalize_trade_row(row, strategy_id, strategy_name):
    """
    Transform a raw TradingView export row into database schema format.
    """
    trade_num = row['Trade #']
    trade_type = row['Type'].lower()
    dt_str = row['Date/Time']
    signal = row['Signal']
    price = float(row['Price USD'])
    quantity = float(row['Position size (qty)'])
    pnl = float(row['Net P&L USD']) if row['Net P&L USD'] else 0.0
    pnl_pct = float(row['Net P&L %']) if row['Net P&L %'] else 0.0
    
    dt = parse_datetime(dt_str)
    if not dt:
        return None
    
    if 'long' in trade_type or 'long' in signal.lower():
        side = 'long'
    elif 'short' in trade_type or 'short' in signal.lower():
        side = 'short'
    else:
        side = 'long'
    
    symbol = STRATEGY_METADATA[strategy_name]['symbol']
    
    return {
        'tradeNum': trade_num,
        'strategyId': strategy_id,
        'strategyName': strategy_name,
        'symbol': symbol,
        'side': side,
        'type': trade_type,
        'signal': signal,
        'dateTime': dt.isoformat(),
        'price': price,
        'quantity': quantity,
        'pnl': pnl,
        'pnlPercent': pnl_pct
    }

def pair_entry_exit_trades(trades):
    """
    Pair entry and exit trades into complete round-trip trades.
    """
    paired_trades = []
    entry_stack = []
    
    for trade in trades:
        if 'entry' in trade['type']:
            entry_stack.append(trade)
        elif 'exit' in trade['type']:
            if entry_stack:
                entry = entry_stack.pop()
                
                paired = {
                    'strategyId': trade['strategyId'],
                    'strategyName': trade['strategyName'],
                    'symbol': trade['symbol'],
                    'side': entry['side'],
                    'quantity': entry['quantity'],
                    'entryPrice': entry['price'],
                    'exitPrice': trade['price'],
                    'entryTime': entry['dateTime'],
                    'exitTime': trade['dateTime'],
                    'pnl': trade['pnl'],
                    'pnlPercent': trade['pnlPercent']
                }
                paired_trades.append(paired)
    
    return paired_trades

def process_strategy_file(filepath, strategy_id):
    """Process a single strategy CSV file."""
    strategy_name = extract_strategy_name(filepath)
    
    print(f"Processing {strategy_name}...")
    
    trades = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            normalized = normalize_trade_row(row, strategy_id, strategy_name)
            if normalized:
                trades.append(normalized)
    
    paired_trades = pair_entry_exit_trades(trades)
    
    print(f"  {len(trades)} raw trades -> {len(paired_trades)} complete round-trip trades")
    
    return paired_trades

def main():
    upload_dir = Path("/home/ubuntu/upload")
    output_dir = Path("/home/ubuntu/Manus-Dashboard/data/seed")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    strategy_files = [
        "ESTrend.csv", "ESORB.csv", "NQTrend.csv", "NQORB.csv",
        "CLTrend.csv", "BTCTrend.csv", "GCTrend.csv", "YMORB.csv"
    ]
    
    print("Generating strategies.csv...")
    strategies_output = output_dir / "strategies.csv"
    with open(strategies_output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'name', 'description', 'symbol', 'type'])
        writer.writeheader()
        for idx, filename in enumerate(strategy_files, start=1):
            strategy_name = extract_strategy_name(filename)
            metadata = STRATEGY_METADATA[strategy_name]
            writer.writerow({
                'id': idx,
                'name': metadata['name'],
                'description': metadata['description'],
                'symbol': metadata['symbol'],
                'type': metadata['type']
            })
    print(f"✓ Created {strategies_output}")
    
    print("\nProcessing strategy trade files...")
    all_trades = []
    for idx, filename in enumerate(strategy_files, start=1):
        filepath = upload_dir / filename
        if not filepath.exists():
            print(f"Warning: {filepath} not found, skipping...")
            continue
        trades = process_strategy_file(filepath, idx)
        all_trades.extend(trades)
    
    print(f"\nGenerating trades.csv with {len(all_trades)} total trades...")
    trades_output = output_dir / "trades.csv"
    if all_trades:
        fieldnames = ['strategyId', 'strategyName', 'symbol', 'side', 'quantity', 
                     'entryPrice', 'exitPrice', 'entryTime', 'exitTime', 'pnl', 'pnlPercent']
        with open(trades_output, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_trades)
        print(f"✓ Created {trades_output}")
    else:
        print("ERROR: No trades were processed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
