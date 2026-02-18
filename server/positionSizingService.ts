/**
 * Position Sizing Service
 *
 * Calculates appropriate contract quantities based on user's account value
 * and the strategy's backtest parameters.
 *
 * Key Concepts:
 * - Backtest Starting Capital: The capital used in the strategy backtest ($100,000)
 * - User Account Value: The user's actual trading account allocation
 * - Position Scaling: Proportionally scale positions based on account size
 *
 * Example:
 * - Backtest: $100,000 starting capital, 1 mini contract per signal
 * - User Account: $50,000
 * - Scaled Position: 0.5 mini contracts (or 5 micro contracts)
 */

// Backtest parameters (these match the strategy backtests)
export const BACKTEST_STARTING_CAPITAL = 100000; // $100,000

// Contract specifications
export const CONTRACT_SPECS = {
  NQ: {
    mini: {
      multiplier: 20, // $20 per point
      margin: 5000, // Approximate margin requirement
    },
    micro: {
      multiplier: 2, // $2 per point
      margin: 500, // Approximate margin requirement
    },
    microToMiniRatio: 10, // 10 micros = 1 mini
  },
  ES: {
    mini: {
      multiplier: 50, // $50 per point
      margin: 5000,
    },
    micro: {
      multiplier: 5, // $5 per point
      margin: 500,
    },
    microToMiniRatio: 10,
  },
} as const;

export interface PositionSizingInput {
  accountValue: number; // User's account allocation in dollars
  useLeveraged: boolean; // Whether to use leveraged position sizing
  contractType: "mini" | "micro"; // User's preferred contract type
  baseQuantity?: number; // Base quantity from signal (default: 1)
}

export interface PositionSizingResult {
  // Calculated quantities
  miniContracts: number; // Number of mini contracts (can be fractional)
  microContracts: number; // Number of micro contracts (can be fractional)
  recommendedMiniContracts: number; // Rounded mini contracts
  recommendedMicroContracts: number; // Rounded micro contracts

  // Scaling factor
  scalingFactor: number; // accountValue / backtestStartingCapital

  // Risk metrics
  marginRequired: number; // Estimated margin requirement
  marginUtilization: number; // marginRequired / accountValue as percentage

  // Explanation
  explanation: string; // Human-readable explanation
}

/**
 * Calculate position size based on user's account value
 *
 * For leveraged strategies:
 * - Scale positions proportionally to account size
 * - If backtest used $100k and user has $50k, use 0.5x the position size
 *
 * For unleveraged strategies:
 * - Use fixed position sizing based on user preference
 */
export function calculatePositionSize(
  input: PositionSizingInput,
  market: "NQ" | "ES" = "NQ"
): PositionSizingResult {
  const { accountValue, useLeveraged, contractType, baseQuantity = 1 } = input;
  const specs = CONTRACT_SPECS[market];

  // Calculate scaling factor
  const scalingFactor = accountValue / BACKTEST_STARTING_CAPITAL;

  // Calculate position size
  let miniContracts: number;
  let microContracts: number;

  if (useLeveraged) {
    // Leveraged: Scale proportionally to account size
    miniContracts = baseQuantity * scalingFactor;
    microContracts = miniContracts * specs.microToMiniRatio;
  } else {
    // Unleveraged: Use base quantity, adjusted for contract type
    if (contractType === "mini") {
      miniContracts = baseQuantity;
      microContracts = baseQuantity * specs.microToMiniRatio;
    } else {
      // User prefers micro contracts
      microContracts = baseQuantity;
      miniContracts = baseQuantity / specs.microToMiniRatio;
    }
  }

  // Round to practical quantities
  const recommendedMiniContracts = Math.max(
    0,
    Math.round(miniContracts * 10) / 10
  );
  const recommendedMicroContracts = Math.max(0, Math.round(microContracts));

  // Calculate margin requirements
  const marginRequired =
    contractType === "mini"
      ? recommendedMiniContracts * specs.mini.margin
      : recommendedMicroContracts * specs.micro.margin;

  const marginUtilization = (marginRequired / accountValue) * 100;

  // Generate explanation
  let explanation: string;
  if (useLeveraged) {
    explanation =
      `With $${accountValue.toLocaleString()} account (${(scalingFactor * 100).toFixed(1)}% of backtest capital), ` +
      `position scaled to ${recommendedMicroContracts} micro contracts (${recommendedMiniContracts.toFixed(1)} mini equivalent).`;
  } else {
    explanation = `Fixed position sizing: ${contractType === "mini" ? recommendedMiniContracts : recommendedMicroContracts} ${contractType} contracts.`;
  }

  return {
    miniContracts,
    microContracts,
    recommendedMiniContracts,
    recommendedMicroContracts,
    scalingFactor,
    marginRequired,
    marginUtilization,
    explanation,
  };
}

/**
 * Format position size for display in alerts
 */
export function formatPositionForAlert(
  result: PositionSizingResult,
  contractType: "mini" | "micro"
): string {
  if (contractType === "mini") {
    return `${result.recommendedMiniContracts} mini`;
  }
  return `${result.recommendedMicroContracts} micro`;
}

/**
 * Calculate position size from user subscription settings
 */
export interface UserSubscriptionSettings {
  accountValue: number | null;
  useLeveraged: boolean;
  quantityMultiplier: string | null;
  maxPositionSize: number | null;
}

export function calculateUserPositionSize(
  settings: UserSubscriptionSettings,
  contractType: "mini" | "micro" = "micro",
  market: "NQ" | "ES" = "NQ"
): PositionSizingResult {
  const accountValue = settings.accountValue || BACKTEST_STARTING_CAPITAL;
  const multiplier = settings.quantityMultiplier
    ? parseFloat(settings.quantityMultiplier)
    : 1;

  const result = calculatePositionSize(
    {
      accountValue,
      useLeveraged: settings.useLeveraged,
      contractType,
      baseQuantity: multiplier,
    },
    market
  );

  // Apply max position size limit if set
  if (settings.maxPositionSize) {
    if (contractType === "mini") {
      result.recommendedMiniContracts = Math.min(
        result.recommendedMiniContracts,
        settings.maxPositionSize
      );
      result.recommendedMicroContracts =
        result.recommendedMiniContracts *
        CONTRACT_SPECS[market].microToMiniRatio;
    } else {
      result.recommendedMicroContracts = Math.min(
        result.recommendedMicroContracts,
        settings.maxPositionSize
      );
      result.recommendedMiniContracts =
        result.recommendedMicroContracts /
        CONTRACT_SPECS[market].microToMiniRatio;
    }
  }

  return result;
}

/**
 * Generate webhook alert payload with position sizing
 */
export interface WebhookAlertPayload {
  strategy: string;
  strategySymbol: string;
  action: "entry" | "exit";
  direction: "Long" | "Short";
  price: number;
  timestamp: Date;
  // Position sizing
  baseQuantity: number;
  userQuantity: number;
  contractType: "mini" | "micro";
  accountValue: number;
  scalingFactor: number;
  // Additional context
  isLeveraged: boolean;
  explanation: string;
}

export function generateAlertPayload(
  strategyName: string,
  strategySymbol: string,
  action: "entry" | "exit",
  direction: "Long" | "Short",
  price: number,
  userSettings: UserSubscriptionSettings,
  contractType: "mini" | "micro" = "micro"
): WebhookAlertPayload {
  const positionSize = calculateUserPositionSize(userSettings, contractType);

  return {
    strategy: strategyName,
    strategySymbol,
    action,
    direction,
    price,
    timestamp: new Date(),
    baseQuantity: 1,
    userQuantity:
      contractType === "mini"
        ? positionSize.recommendedMiniContracts
        : positionSize.recommendedMicroContracts,
    contractType,
    accountValue: userSettings.accountValue || BACKTEST_STARTING_CAPITAL,
    scalingFactor: positionSize.scalingFactor,
    isLeveraged: userSettings.useLeveraged,
    explanation: positionSize.explanation,
  };
}
