import { z } from "zod";
import { logger } from "./logger";

/**
 * Comprehensive API Request Validation Layer
 * Validates all incoming requests and provides detailed error messages
 */

// Common validation schemas
export const commonSchemas = {
  // User validation
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  userId: z.number().positive("User ID must be positive"),

  // Trade validation
  price: z.number().positive("Price must be positive"),
  quantity: z.number().positive("Quantity must be positive"),
  date: z.string().datetime("Invalid date format"),
  isoDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "Invalid ISO date format"),

  // Strategy validation
  strategyId: z.number().positive("Strategy ID must be positive"),
  strategyName: z
    .string()
    .min(1, "Strategy name is required")
    .max(255, "Strategy name too long"),

  // Pagination
  limit: z
    .number()
    .min(1, "Limit must be at least 1")
    .max(1000, "Limit cannot exceed 1000")
    .default(100),
  offset: z.number().min(0, "Offset must be non-negative").default(0),

  // Time range
  timeRange: z.enum(["6M", "YTD", "1Y", "3Y", "5Y", "10Y", "ALL"]),

  // Monetary
  amount: z.number().positive("Amount must be positive"),
  percentage: z
    .number()
    .min(0, "Percentage cannot be negative")
    .max(100, "Percentage cannot exceed 100"),
};

// Request validation schemas
export const validationSchemas = {
  // Authentication
  login: z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
  }),

  register: z
    .object({
      email: commonSchemas.email,
      password: commonSchemas.password,
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),

  // Portfolio
  portfolioOverview: z.object({
    timeRange: commonSchemas.timeRange.optional(),
    startingCapital: z.number().positive().default(100000),
    contractMultiplier: z.number().positive().default(1),
    source: z.enum(["csv_import", "webhook", "manual", "all"]).default("all"),
    strategyIds: z.array(z.number()).optional(),
    isLeveraged: z.boolean().default(false),
  }),

  // Trades
  createTrade: z.object({
    strategyId: commonSchemas.strategyId,
    entryDate: commonSchemas.isoDate,
    exitDate: commonSchemas.isoDate,
    entryPrice: commonSchemas.price,
    exitPrice: commonSchemas.price,
    quantity: commonSchemas.quantity,
    source: z.enum(["csv_import", "webhook", "manual"]).default("manual"),
  }),

  updateTrade: z.object({
    id: z.number().positive(),
    entryDate: commonSchemas.isoDate.optional(),
    exitDate: commonSchemas.isoDate.optional(),
    entryPrice: commonSchemas.price.optional(),
    exitPrice: commonSchemas.price.optional(),
    quantity: commonSchemas.quantity.optional(),
  }),

  deleteTrade: z.object({
    id: z.number().positive(),
  }),

  // Strategies
  createStrategy: z.object({
    name: commonSchemas.strategyName,
    symbol: z.string().min(1).max(10),
    market: z.string().min(1).max(50),
    description: z.string().optional(),
    microToMiniRatio: z.number().positive().optional(),
  }),

  updateStrategy: z.object({
    id: commonSchemas.strategyId,
    name: commonSchemas.strategyName.optional(),
    symbol: z.string().min(1).max(10).optional(),
    market: z.string().min(1).max(50).optional(),
    description: z.string().optional(),
  }),

  deleteStrategy: z.object({
    id: commonSchemas.strategyId,
  }),

  // Export
  exportTrades: z.object({
    format: z.enum(["csv", "json", "excel"]),
    startDate: commonSchemas.isoDate.optional(),
    endDate: commonSchemas.isoDate.optional(),
    strategyIds: z.array(z.number()).optional(),
  }),

  // Pagination
  pagination: z.object({
    limit: commonSchemas.limit,
    offset: commonSchemas.offset,
  }),

  // Search/Filter
  tradeFilter: z.object({
    strategyId: commonSchemas.strategyId.optional(),
    startDate: commonSchemas.isoDate.optional(),
    endDate: commonSchemas.isoDate.optional(),
    minPnL: z.number().optional(),
    maxPnL: z.number().optional(),
    limit: commonSchemas.limit,
    offset: commonSchemas.offset,
  }),
};

/**
 * Validate request data
 */
export const validateRequest = <T>(
  schema: z.ZodSchema,
  data: any,
  context: string = "request"
): { valid: boolean; data?: T; errors?: Record<string, string> } => {
  try {
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string> = {};

      // @ts-expect-error TS2339
      result.error.errors.forEach((error: any) => {
        const path = error.path.join(".");
        errors[path] = error.message;
      });

      logger.warn(`Validation failed for ${context}`, { errors });

      return {
        valid: false,
        errors,
      };
    }

    return {
      valid: true,
      data: result.data as T,
    };
  } catch (error) {
    logger.error(`Validation error for ${context}`, error);

    return {
      valid: false,
      errors: {
        _error: "Validation failed",
      },
    };
  }
};

/**
 * Middleware for request validation
 */
export const createValidationMiddleware = (
  schema: z.ZodSchema,
  source: "body" | "query" | "params" = "body"
) => {
  return (req: any, res: any, next: any) => {
    const data =
      source === "body"
        ? req.body
        : source === "query"
          ? req.query
          : req.params;

    const validation = validateRequest(schema, data, `${source} validation`);

    if (!validation.valid) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: validation.errors,
        },
      });
    }

    // Attach validated data to request
    if (source === "body") {
      req.body = validation.data;
    } else if (source === "query") {
      req.query = validation.data;
    } else {
      req.params = validation.data;
    }

    next();
  };
};

/**
 * Sanitize input data
 */
export const sanitizeInput = (data: any): any => {
  if (typeof data === "string") {
    return data
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/["']/g, "") // Remove quotes
      .trim();
  }

  if (typeof data === "object" && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeInput(item));
    }

    const sanitized: Record<string, any> = {};
    for (const key in data) {
      sanitized[key] = sanitizeInput(data[key]);
    }
    return sanitized;
  }

  return data;
};

/**
 * Validate date range
 */
export const validateDateRange = (startDate: Date, endDate: Date): boolean => {
  if (startDate >= endDate) {
    logger.warn("Invalid date range", { startDate, endDate });
    return false;
  }

  // Check if range is not more than 10 years
  const maxRange = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years in ms
  if (endDate.getTime() - startDate.getTime() > maxRange) {
    logger.warn("Date range exceeds maximum", { startDate, endDate });
    return false;
  }

  return true;
};

/**
 * Validate numeric range
 */
export const validateNumericRange = (
  value: number,
  min: number,
  max: number
): boolean => {
  return value >= min && value <= max;
};

/**
 * Validate enum value
 */
export const validateEnum = <T>(value: any, enumValues: T[]): boolean => {
  return enumValues.includes(value);
};

/**
 * Get validation error message
 */
export const getValidationErrorMessage = (
  errors: Record<string, string>
): string => {
  const messages = Object.entries(errors).map(
    ([field, message]) => `${field}: ${message}`
  );
  return messages.join("; ");
};

export default {
  commonSchemas,
  validationSchemas,
  validateRequest,
  createValidationMiddleware,
  sanitizeInput,
  validateDateRange,
  validateNumericRange,
  validateEnum,
  getValidationErrorMessage,
};
