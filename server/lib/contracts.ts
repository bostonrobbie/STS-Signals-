/**
 * Contract Size Conversion Utilities
 * 
 * Handles conversion between mini/standard and micro contracts for futures trading.
 * Data in database is stored in MINI format (from TradingView/Tradeovate).
 */

export type ContractSize = 'mini' | 'micro';

/**
 * Convert P&L from mini to micro contracts
 * @param miniPnL P&L in mini contract format (cents)
 * @param ratio Micro-to-mini ratio (10 for most, 50 for BTC)
 * @returns P&L in micro contract format (cents)
 */
export function miniToMicro(miniPnL: number, ratio: number): number {
  return Math.round(miniPnL / ratio);
}

/**
 * Convert P&L from micro to mini contracts
 * @param microPnL P&L in micro contract format (cents)
 * @param ratio Micro-to-mini ratio (10 for most, 50 for BTC)
 * @returns P&L in mini contract format (cents)
 */
export function microToMini(microPnL: number, ratio: number): number {
  return Math.round(microPnL * ratio);
}

/**
 * Convert P&L based on target contract size
 * @param pnl P&L in cents (assumed to be in mini format from database)
 * @param targetSize Target contract size
 * @param ratio Micro-to-mini ratio
 * @returns Converted P&L in cents
 */
export function convertPnL(
  pnl: number,
  targetSize: ContractSize,
  ratio: number
): number {
  // Data is stored in mini format
  if (targetSize === 'mini') {
    return pnl; // No conversion needed
  }
  return miniToMicro(pnl, ratio);
}

/**
 * Convert price based on target contract size
 * @param price Price in cents (assumed to be in mini format from database)
 * @param targetSize Target contract size
 * @param ratio Micro-to-mini ratio
 * @returns Converted price in cents
 */
export function convertPrice(
  price: number,
  _targetSize: ContractSize,
  _ratio: number
): number {
  // Prices don't change, only P&L multipliers change
  // But for display purposes, we might want to show adjusted values
  return price; // Prices remain the same
}

/**
 * Get contract size label for display
 * @param size Contract size
 * @returns Human-readable label
 */
export function getContractLabel(size: ContractSize): string {
  return size === 'mini' ? 'Mini/Standard' : 'Micro';
}

/**
 * Get contract multiplier description
 * @param market Market symbol (ES, NQ, CL, BTC, GC, YM)
 * @returns Description of contract value
 */
export function getContractMultiplierDescription(market: string | null): {
  mini: string;
  micro: string;
} {
  const descriptions: Record<string, { mini: string; micro: string }> = {
    ES: { mini: '$50/point', micro: '$5/point' },
    NQ: { mini: '$20/point', micro: '$2/point' },
    CL: { mini: '$1,000/barrel', micro: '$100/barrel' },
    BTC: { mini: '5 BTC', micro: '0.1 BTC' },
    GC: { mini: '100 oz', micro: '10 oz' },
    YM: { mini: '$5/point', micro: '$0.50/point' },
  };

  return descriptions[market || ''] || { mini: 'Standard', micro: 'Micro' };
}

/**
 * Apply contract conversion to an array of trades
 * @param trades Array of trades with pnl field
 * @param targetSize Target contract size
 * @param ratio Micro-to-mini ratio
 * @returns Trades with converted P&L values
 */
export function convertTrades<T extends { pnl: number }>(
  trades: T[],
  targetSize: ContractSize,
  ratio: number
): T[] {
  if (targetSize === 'mini') {
    return trades; // No conversion needed
  }

  return trades.map((trade) => ({
    ...trade,
    pnl: convertPnL(trade.pnl, targetSize, ratio),
  }));
}

/**
 * Apply contract conversion to equity curve data
 * @param equityCurve Array of equity points
 * @param targetSize Target contract size
 * @param ratio Micro-to-mini ratio
 * @param startingCapital Starting capital in cents
 * @returns Equity curve with converted values
 */
export function convertEquityCurve(
  equityCurve: Array<{ date: Date; equity: number }>,
  targetSize: ContractSize,
  ratio: number,
  startingCapital: number
): Array<{ date: Date; equity: number }> {
  if (targetSize === 'mini') {
    return equityCurve; // No conversion needed
  }

  // Convert each equity point
  return equityCurve.map((point) => {
    const pnl = point.equity - startingCapital;
    const convertedPnl = convertPnL(pnl, targetSize, ratio);
    return {
      date: point.date,
      equity: startingCapital + convertedPnl,
    };
  });
}
