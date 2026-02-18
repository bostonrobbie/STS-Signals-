/**
 * Position Sizing Calculator
 *
 * Calculates appropriate contract quantities based on:
 * - Account size
 * - Risk tolerance (% of account)
 * - Strategy's max drawdown
 * - Contract specifications (point value, margin requirements)
 */

export interface ContractSpec {
  symbol: string;
  pointValue: number; // Dollar value per point movement
  marginRequirement: number; // Initial margin per contract
  tickSize: number; // Minimum price movement
}

export interface PositionSizingInput {
  accountSize: number;
  riskPercentage: number; // 1-5% typical
  maxDrawdown: number; // Strategy's historical max DD in dollars
  contractSpec: ContractSpec;
}

export interface PositionSizingResult {
  recommendedContracts: number;
  riskAmount: number; // Dollar amount at risk
  marginRequired: number; // Total margin for position
  marginUtilization: number; // % of account used as margin
  maxLossScenario: number; // Potential loss if max DD repeats
  notes: string[];
}

// Contract specifications for E-mini futures
export const CONTRACT_SPECS: Record<string, ContractSpec> = {
  NQ: {
    symbol: "NQ",
    pointValue: 20, // $20 per point
    marginRequirement: 17000, // Approximate intraday margin
    tickSize: 0.25,
  },
  ES: {
    symbol: "ES",
    pointValue: 50, // $50 per point
    marginRequirement: 12000,
    tickSize: 0.25,
  },
  YM: {
    symbol: "YM",
    pointValue: 5, // $5 per point
    marginRequirement: 7000,
    tickSize: 1,
  },
  CL: {
    symbol: "CL",
    pointValue: 1000, // $1000 per point (crude oil)
    marginRequirement: 6000,
    tickSize: 0.01,
  },
  GC: {
    symbol: "GC",
    pointValue: 100, // $100 per point (gold)
    marginRequirement: 10000,
    tickSize: 0.1,
  },
  // Strategy-specific symbols (map to underlying contract)
  NQTrend: {
    symbol: "NQ",
    pointValue: 20, // $20 per point
    marginRequirement: 17000,
    tickSize: 0.25,
  },
  NQTrendLeveraged: {
    symbol: "NQ",
    pointValue: 20, // $20 per point
    marginRequirement: 17000,
    tickSize: 0.25,
  },
};

/**
 * Calculate recommended contract quantity based on risk management principles
 */
export function calculatePositionSize(
  input: PositionSizingInput
): PositionSizingResult {
  const { accountSize, riskPercentage, maxDrawdown, contractSpec } = input;

  const notes: string[] = [];

  // Calculate risk amount (how much user is willing to lose)
  const riskAmount = accountSize * (riskPercentage / 100);

  // Method 1: Based on max drawdown per contract
  // If max DD is $10k per contract, and user wants to risk $5k, they should trade 0.5 contracts
  const contractsByRisk = Math.floor(riskAmount / Math.abs(maxDrawdown));

  // Method 2: Based on margin requirements (don't over-leverage)
  // Use max 50% of account for margin (conservative)
  const maxMarginToUse = accountSize * 0.5;
  const contractsByMargin = Math.floor(
    maxMarginToUse / contractSpec.marginRequirement
  );

  // Take the more conservative approach
  let recommendedContracts = Math.min(contractsByRisk, contractsByMargin);

  // Minimum 1 contract if account can afford it
  if (
    recommendedContracts === 0 &&
    accountSize >= contractSpec.marginRequirement
  ) {
    recommendedContracts = 1;
    notes.push(
      "Account size is below recommended minimum for this risk level. Consider starting with 1 contract and lower risk."
    );
  }

  // Calculate actual metrics for recommended position
  const marginRequired = recommendedContracts * contractSpec.marginRequirement;
  const marginUtilization = (marginRequired / accountSize) * 100;
  const maxLossScenario = Math.abs(maxDrawdown) * recommendedContracts;

  // Add warnings if needed
  if (marginUtilization > 50) {
    notes.push(
      "Warning: Margin utilization exceeds 50%. Consider reducing position size."
    );
  }

  if (maxLossScenario > accountSize * 0.2) {
    notes.push(
      "Warning: Max loss scenario exceeds 20% of account. Consider reducing risk percentage."
    );
  }

  if (recommendedContracts === 0) {
    notes.push(
      `Account size too small for this strategy. Minimum recommended: $${Math.ceil(contractSpec.marginRequirement * 2).toLocaleString()}`
    );
  }

  return {
    recommendedContracts,
    riskAmount,
    marginRequired,
    marginUtilization,
    maxLossScenario,
    notes,
  };
}

/**
 * Calculate Kelly Criterion for optimal position sizing
 * Kelly % = (Win Rate * Avg Win - Loss Rate * Avg Loss) / Avg Win
 */
export function calculateKellyCriterion(
  winRate: number,
  avgWin: number,
  avgLoss: number
): number {
  const lossRate = 1 - winRate;
  const kelly = (winRate * avgWin - lossRate * Math.abs(avgLoss)) / avgWin;

  // Use fractional Kelly (25% of full Kelly) for safety
  const fractionalKelly = kelly * 0.25;

  return Math.max(0, Math.min(fractionalKelly, 0.05)); // Cap at 5%
}
