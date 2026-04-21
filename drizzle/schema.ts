import {
  mysqlTable,
  index,
  int,
  varchar,
  text,
  mysqlEnum,
  timestamp,
  datetime,
  decimal,
  tinyint,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int().autoincrement().notNull(),
    userId: int(),
    action: varchar({ length: 100 }).notNull(),
    resourceType: varchar({ length: 50 }),
    resourceId: int(),
    ipAddress: varchar({ length: 45 }),
    userAgent: text(),
    previousValue: text(),
    newValue: text(),
    status: mysqlEnum(["success", "failure"]).default("success").notNull(),
    errorMessage: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_user_action").on(table.userId, table.action),
    index("idx_created").on(table.createdAt),
  ]
);

export const benchmarks = mysqlTable(
  "benchmarks",
  {
    id: int().autoincrement().notNull(),
    symbol: varchar({ length: 10 }).default("SPY").notNull(),
    date: datetime({ mode: "string" }).notNull(),
    open: int().notNull(),
    high: int().notNull(),
    low: int().notNull(),
    close: int().notNull(),
    volume: int(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [index("idx_benchmarks_symbol_date").on(table.symbol, table.date)]
);

export const brokerConnections = mysqlTable(
  "broker_connections",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    broker: mysqlEnum(["tradovate", "ibkr", "fidelity", "alpaca"]).notNull(),
    name: varchar({ length: 100 }).notNull(),
    status: mysqlEnum(["disconnected", "connecting", "connected", "error"])
      .default("disconnected")
      .notNull(),
    encryptedCredentials: text(),
    accountId: varchar({ length: 100 }),
    accountName: varchar({ length: 100 }),
    accountType: varchar({ length: 50 }),
    accessToken: text(),
    refreshToken: text(),
    tokenExpiresAt: datetime({ mode: "string" }),
    lastConnectedAt: datetime({ mode: "string" }),
    lastError: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_broker_connections_user").on(table.userId),
    index("idx_broker_connections_status").on(table.status),
  ]
);

export const brokerOrders = mysqlTable(
  "broker_orders",
  {
    id: int().autoincrement().notNull(),
    webhookLogId: int(),
    openPositionId: int(),
    tradeId: int(),
    internalOrderId: varchar({ length: 64 }).notNull(),
    brokerOrderId: varchar({ length: 64 }),
    broker: varchar({ length: 20 }).notNull(),
    strategySymbol: varchar({ length: 50 }).notNull(),
    symbol: varchar({ length: 20 }).notNull(),
    action: mysqlEnum(["buy", "sell"]).notNull(),
    orderType: mysqlEnum(["market", "limit", "stop", "stop_limit"])
      .default("market")
      .notNull(),
    quantity: int().notNull(),
    requestedPrice: int(),
    limitPrice: int(),
    stopPrice: int(),
    filledQuantity: int().default(0).notNull(),
    avgFillPrice: int(),
    commission: int().default(0),
    status: mysqlEnum([
      "pending",
      "submitted",
      "acknowledged",
      "working",
      "partially_filled",
      "filled",
      "cancelled",
      "rejected",
      "expired",
      "error",
    ])
      .default("pending")
      .notNull(),
    brokerStatus: varchar({ length: 100 }),
    rejectReason: text(),
    submittedAt: datetime({ mode: "string" }),
    acknowledgedAt: datetime({ mode: "string" }),
    filledAt: datetime({ mode: "string" }),
    cancelledAt: datetime({ mode: "string" }),
    isTest: tinyint().default(0).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_broker_orders_internal").on(table.internalOrderId),
    index("idx_broker_orders_broker").on(table.brokerOrderId),
    index("idx_broker_orders_status").on(table.status),
    index("idx_broker_orders_strategy").on(table.strategySymbol),
    index("internalOrderId").on(table.internalOrderId),
  ]
);

export const contactMessages = mysqlTable(
  "contact_messages",
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 320 }).notNull(),
    userId: int(),
    subject: varchar({ length: 200 }).notNull(),
    message: text().notNull(),
    category: mysqlEnum([
      "general",
      "support",
      "billing",
      "feature_request",
      "bug_report",
      "partnership",
    ])
      .default("general")
      .notNull(),
    status: mysqlEnum([
      "new",
      "read",
      "in_progress",
      "awaiting_response",
      "resolved",
      "closed",
    ])
      .default("new")
      .notNull(),
    priority: mysqlEnum(["low", "normal", "high", "urgent"])
      .default("normal")
      .notNull(),
    aiSuggestedResponse: text(),
    aiResponseGeneratedAt: datetime({ mode: "string" }),
    ipAddress: varchar({ length: 45 }),
    userAgent: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_contact_messages_status").on(table.status),
    index("idx_contact_messages_email").on(table.email),
    index("idx_contact_messages_created").on(table.createdAt),
  ]
);

export const contactResponses = mysqlTable(
  "contact_responses",
  {
    id: int().autoincrement().notNull(),
    messageId: int().notNull(),
    responseText: text().notNull(),
    isAiGenerated: tinyint().default(0).notNull(),
    approvedBy: int(),
    approvedAt: datetime({ mode: "string" }),
    sentAt: datetime({ mode: "string" }),
    deliveryStatus: mysqlEnum(["draft", "approved", "sent", "failed"])
      .default("draft")
      .notNull(),
    errorMessage: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_contact_responses_message").on(table.messageId),
    index("idx_contact_responses_status").on(table.deliveryStatus),
  ]
);

export const deadLetterQueue = mysqlTable(
  "dead_letter_queue",
  {
    id: int().autoincrement().notNull(),
    originalPayload: text().notNull(),
    ipAddress: varchar({ length: 45 }),
    failureReason: text().notNull(),
    attempts: int().notNull(),
    lastAttemptAt: datetime({ mode: "string" }),
    errorHistory: text(),
    status: mysqlEnum(["unresolved", "resolved", "ignored"])
      .default("unresolved")
      .notNull(),
    resolvedBy: int(),
    resolvedAt: datetime({ mode: "string" }),
    resolutionNotes: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [index("idx_status").on(table.status)]
);

export const executionLogs = mysqlTable(
  "execution_logs",
  {
    id: int().autoincrement().notNull(),
    webhookLogId: int()
      .notNull()
      .references(() => webhookLogs.id, { onDelete: "cascade" }),
    routingRuleId: int(),
    brokerConnectionId: int()
      .notNull()
      .references(() => brokerConnections.id, { onDelete: "cascade" }),
    status: mysqlEnum([
      "pending",
      "submitted",
      "filled",
      "partial",
      "rejected",
      "cancelled",
      "error",
    ])
      .default("pending")
      .notNull(),
    orderType: varchar({ length: 20 }),
    side: varchar({ length: 10 }),
    symbol: varchar({ length: 20 }),
    quantity: int(),
    price: int(),
    brokerOrderId: varchar({ length: 100 }),
    fillPrice: int(),
    fillQuantity: int(),
    commission: int(),
    submittedAt: datetime({ mode: "string" }),
    filledAt: datetime({ mode: "string" }),
    errorMessage: text(),
    retryCount: int().default(0).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_execution_logs_webhook").on(table.webhookLogId),
    index("idx_execution_logs_broker").on(table.brokerConnectionId),
    index("idx_execution_logs_status").on(table.status),
  ]
);

export const notificationPreferences = mysqlTable(
  "notification_preferences",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailNotificationsEnabled: tinyint().default(1).notNull(),
    pushNotificationsEnabled: tinyint().default(1).notNull(),
    notifyOnEntry: tinyint().default(1).notNull(),
    notifyOnExit: tinyint().default(1).notNull(),
    notifyOnProfit: tinyint().default(1).notNull(),
    notifyOnLoss: tinyint().default(1).notNull(),
    globalMute: tinyint().default(0).notNull(),
    muteTradeExecuted: tinyint().default(0).notNull(),
    muteTradeError: tinyint().default(0).notNull(),
    mutePositionOpened: tinyint().default(0).notNull(),
    mutePositionClosed: tinyint().default(0).notNull(),
    muteWebhookFailed: tinyint().default(0).notNull(),
    muteDailyDigest: tinyint().default(0).notNull(),
    emailEnabled: tinyint().default(1).notNull(),
    emailAddress: varchar({ length: 320 }),
    inAppEnabled: tinyint().default(1).notNull(),
    soundEnabled: tinyint().default(1).notNull(),
    quietHoursStart: varchar({ length: 5 }),
    quietHoursEnd: varchar({ length: 5 }),
    quietHoursTimezone: varchar({ length: 50 }).default("America/New_York"),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("unique_user").on(table.userId)]
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int().autoincrement().notNull(),
    userId: int().notNull(),
    type: mysqlEnum([
      "trade_executed",
      "trade_error",
      "position_opened",
      "position_closed",
      "webhook_failed",
      "daily_digest",
      "system",
    ]).notNull(),
    title: varchar({ length: 200 }).notNull(),
    message: text().notNull(),
    strategyId: int(),
    tradeId: int(),
    webhookLogId: int(),
    read: tinyint().default(0).notNull(),
    dismissed: tinyint().default(0).notNull(),
    emailSent: tinyint().default(0).notNull(),
    emailSentAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_notifications_user").on(table.userId),
    index("idx_notifications_type").on(table.type),
    index("idx_notifications_read").on(table.read),
    index("idx_notifications_created").on(table.createdAt),
  ]
);

export const openPositions = mysqlTable(
  "open_positions",
  {
    id: int().autoincrement().notNull(),
    strategyId: int()
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    strategySymbol: varchar({ length: 20 }).notNull(),
    direction: varchar({ length: 10 }).notNull(),
    entryPrice: int().notNull(),
    quantity: int().default(1).notNull(),
    entryTime: datetime({ mode: "string" }).notNull(),
    entryWebhookLogId: int(),
    status: mysqlEnum(["open", "closing", "closed"]).default("open").notNull(),
    exitPrice: int(),
    exitTime: datetime({ mode: "string" }),
    exitWebhookLogId: int(),
    pnl: int(),
    tradeId: int(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
    isTest: tinyint().default(0).notNull(),
  },
  table => [
    index("idx_open_positions_strategy").on(table.strategyId),
    index("idx_open_positions_status").on(table.status),
    index("idx_open_positions_strategy_status").on(
      table.strategyId,
      table.status
    ),
  ]
);

export const paperAccounts = mysqlTable(
  "paper_accounts",
  {
    id: int().autoincrement().notNull(),
    userId: int().notNull(),
    name: varchar({ length: 100 }).notNull(),
    balance: int().default(10000000).notNull(),
    startingBalance: int().default(10000000).notNull(),
    realizedPnl: int().default(0),
    totalTrades: int().default(0),
    winningTrades: int().default(0),
    losingTrades: int().default(0),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("idx_paper_accounts_user").on(table.userId)]
);

export const paperPositions = mysqlTable(
  "paper_positions",
  {
    id: int().autoincrement().notNull(),
    accountId: int().notNull(),
    strategyId: int(),
    symbol: varchar({ length: 20 }).notNull(),
    side: mysqlEnum(["LONG", "SHORT"]).notNull(),
    quantity: int().notNull(),
    entryPrice: int().notNull(),
    entryDate: datetime({ mode: "string" }).notNull(),
    exitPrice: int(),
    exitDate: datetime({ mode: "string" }),
    status: mysqlEnum(["open", "closed"]).default("open").notNull(),
    unrealizedPnl: int().default(0),
    realizedPnl: int().default(0),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_paper_positions_account").on(table.accountId),
    index("idx_paper_positions_status").on(table.status),
    index("idx_paper_positions_symbol").on(table.symbol),
  ]
);

export const paperTrades = mysqlTable(
  "paper_trades",
  {
    id: int().autoincrement().notNull(),
    accountId: int().notNull(),
    positionId: int(),
    strategyId: int(),
    symbol: varchar({ length: 20 }).notNull(),
    side: mysqlEnum(["BUY", "SELL"]).notNull(),
    quantity: int().notNull(),
    price: int().notNull(),
    orderType: mysqlEnum(["MARKET", "LIMIT", "STOP"]).notNull(),
    pnl: int().default(0),
    commission: int().default(0),
    executedAt: datetime({ mode: "string" }).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_paper_trades_account").on(table.accountId),
    index("idx_paper_trades_position").on(table.positionId),
    index("idx_paper_trades_executed").on(table.executedAt),
  ]
);

export const paymentHistory = mysqlTable(
  "payment_history",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: int(),
    amount: int().notNull(),
    currency: varchar({ length: 3 }).default("USD").notNull(),
    status: mysqlEnum(["pending", "succeeded", "failed", "refunded"])
      .default("pending")
      .notNull(),
    stripePaymentIntentId: varchar({ length: 100 }),
    stripeInvoiceId: varchar({ length: 100 }),
    receiptUrl: text(),
    description: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_payment_history_user").on(table.userId),
    index("idx_payment_history_status").on(table.status),
    index("idx_payment_history_created").on(table.createdAt),
  ]
);

export const positionAdjustments = mysqlTable(
  "position_adjustments",
  {
    id: int().autoincrement().notNull(),
    openPositionId: int(),
    strategySymbol: varchar({ length: 50 }).notNull(),
    adjustmentType: mysqlEnum([
      "force_close",
      "force_open",
      "quantity_adjust",
      "price_adjust",
      "sync_from_broker",
      "manual_override",
    ]).notNull(),
    beforeDirection: varchar({ length: 10 }),
    beforeQuantity: int(),
    beforeEntryPrice: int(),
    afterDirection: varchar({ length: 10 }),
    afterQuantity: int(),
    afterEntryPrice: int(),
    reason: text().notNull(),
    adjustedBy: varchar({ length: 100 }).notNull(),
    reconciliationLogId: int(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_position_adjustments_position").on(table.openPositionId),
    index("idx_position_adjustments_strategy").on(table.strategySymbol),
    index("idx_position_adjustments_type").on(table.adjustmentType),
  ]
);

export const reconciliationLogs = mysqlTable(
  "reconciliation_logs",
  {
    id: int().autoincrement().notNull(),
    reconciliationId: varchar({ length: 64 }).notNull(),
    runAt: datetime({ mode: "string" }).notNull(),
    broker: varchar({ length: 20 }).notNull(),
    accountId: varchar({ length: 64 }),
    strategySymbol: varchar({ length: 50 }),
    symbol: varchar({ length: 20 }).notNull(),
    dbPositionId: int(),
    dbDirection: varchar({ length: 10 }),
    dbQuantity: int(),
    dbEntryPrice: int(),
    brokerDirection: varchar({ length: 10 }),
    brokerQuantity: int(),
    brokerAvgPrice: int(),
    discrepancyType: mysqlEnum([
      "missing_in_db",
      "missing_in_broker",
      "quantity_mismatch",
      "direction_mismatch",
      "price_mismatch",
      "matched",
    ]).notNull(),
    discrepancyDetails: text(),
    resolved: tinyint().default(0).notNull(),
    resolvedAt: datetime({ mode: "string" }),
    resolvedBy: varchar({ length: 100 }),
    resolutionAction: varchar({ length: 50 }),
    resolutionNotes: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_reconciliation_run").on(table.reconciliationId),
    index("idx_reconciliation_broker").on(table.broker),
    index("idx_reconciliation_discrepancy").on(table.discrepancyType),
    index("idx_reconciliation_unresolved").on(table.resolved),
  ]
);

export const routingRules = mysqlTable(
  "routing_rules",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    strategyId: int(),
    direction: varchar({ length: 10 }),
    brokerConnectionId: int()
      .notNull()
      .references(() => brokerConnections.id, { onDelete: "cascade" }),
    enabled: tinyint().default(1).notNull(),
    autoExecute: tinyint().default(0).notNull(),
    quantityMultiplier: decimal({ precision: 10, scale: 4 })
      .default("1.0000")
      .notNull(),
    maxPositionSize: int(),
    maxDailyLoss: int(),
    priority: int().default(0).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_routing_rules_user").on(table.userId),
    index("idx_routing_rules_broker").on(table.brokerConnectionId),
  ]
);

export const signalBatches = mysqlTable(
  "signal_batches",
  {
    id: int().autoincrement().notNull(),
    batchId: varchar({ length: 50 }).notNull(),
    strategySymbol: varchar({ length: 20 }).notNull(),
    windowStartAt: datetime({ mode: "string" }).notNull(),
    windowEndAt: datetime({ mode: "string" }),
    signalCount: int().default(0).notNull(),
    netDirection: varchar({ length: 10 }),
    netQuantity: int().default(0).notNull(),
    avgPrice: int(),
    status: mysqlEnum(["collecting", "processing", "completed", "failed"])
      .default("collecting")
      .notNull(),
    resultWebhookLogId: int(),
    errorMessage: text(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_signal_batches_batch").on(table.batchId),
    index("idx_signal_batches_strategy").on(table.strategySymbol),
    index("idx_signal_batches_status").on(table.status),
    index("batchId").on(table.batchId),
  ]
);

export const stagingTrades = mysqlTable(
  "staging_trades",
  {
    id: int().autoincrement().notNull(),
    webhookLogId: int().notNull(),
    strategyId: int().notNull(),
    strategySymbol: varchar({ length: 20 }).notNull(),
    entryDate: datetime({ mode: "string" }).notNull(),
    exitDate: datetime({ mode: "string" }),
    direction: varchar({ length: 10 }).notNull(),
    entryPrice: int().notNull(),
    exitPrice: int(),
    quantity: int().default(1).notNull(),
    pnl: int(),
    pnlPercent: int(),
    commission: int().default(0).notNull(),
    isOpen: tinyint().default(1).notNull(),
    status: mysqlEnum(["pending", "approved", "rejected", "edited"])
      .default("pending")
      .notNull(),
    reviewedBy: int(),
    reviewedAt: datetime({ mode: "string" }),
    reviewNotes: text(),
    originalPayload: text(),
    productionTradeId: int(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_staging_trades_webhook").on(table.webhookLogId),
    index("idx_staging_trades_strategy").on(table.strategyId),
    index("idx_staging_trades_status").on(table.status),
    index("idx_staging_trades_is_open").on(table.isOpen),
    index("idx_staging_trades_created").on(table.createdAt),
  ]
);

export const strategies = mysqlTable(
  "strategies",
  {
    id: int().autoincrement().notNull(),
    symbol: varchar({ length: 20 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    market: varchar({ length: 50 }),
    strategyType: varchar({ length: 50 }),
    active: tinyint().default(1).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
    contractSize: mysqlEnum(["mini", "micro"]).default("mini").notNull(),
    microToMiniRatio: int().default(10).notNull(),
  },
  table => [index("strategies_symbol_unique").on(table.symbol)]
);

export const strategyNotificationSettings = mysqlTable(
  "strategy_notification_settings",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    strategyId: int()
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    emailEnabled: tinyint().default(1).notNull(),
    pushEnabled: tinyint().default(1).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("unique_user_strategy").on(table.userId, table.strategyId)]
);

export const subscriptionTiers = mysqlTable("subscription_tiers", {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 50 }).notNull(),
  description: text(),
  priceMonthly: int().notNull(),
  priceYearly: int(),
  maxStrategies: int(),
  maxBrokerConnections: int(),
  autoExecuteAllowed: tinyint().default(0).notNull(),
  prioritySupport: tinyint().default(0).notNull(),
  stripeProductId: varchar({ length: 100 }),
  stripePriceIdMonthly: varchar({ length: 100 }),
  stripePriceIdYearly: varchar({ length: 100 }),
  active: tinyint().default(1).notNull(),
  createdAt: timestamp({ mode: "string" })
    .default("CURRENT_TIMESTAMP")
    .notNull(),
  updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
});

export const trades = mysqlTable(
  "trades",
  {
    id: int().autoincrement().notNull(),
    strategyId: int()
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    entryDate: datetime({ mode: "string" }).notNull(),
    exitDate: datetime({ mode: "string" }).notNull(),
    direction: varchar({ length: 10 }).notNull(),
    entryPrice: int().notNull(),
    exitPrice: int().notNull(),
    quantity: int().default(1).notNull(),
    pnl: int().notNull(),
    pnlPercent: int().notNull(),
    commission: int().default(0).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    isTest: tinyint().default(0).notNull(),
    source: mysqlEnum(["csv_import", "webhook", "manual"])
      .default("csv_import")
      .notNull(),
  },
  table => [
    index("idx_trades_strategy").on(table.strategyId),
    index("idx_trades_exit_date").on(table.exitDate),
    index("idx_trades_strategy_exit").on(table.strategyId, table.exitDate),
    index("idx_trades_strategy_entry_exit").on(
      table.strategyId,
      table.entryDate,
      table.exitDate
    ),
    index("idx_trades_source").on(table.source),
    // Composite indexes covering the post-isTest-audit query pattern.
    // Every subscriber-visible getTrades() call now filters isTest = 0,
    // so leading the index with isTest lets MySQL skip every test row
    // without scanning. Dramatically faster on a 7,900-row table.
    index("idx_trades_istest_strategy").on(table.isTest, table.strategyId),
    index("idx_trades_istest_exit").on(table.isTest, table.exitDate),
  ]
);

export const userPaymentSubscriptions = mysqlTable(
  "user_payment_subscriptions",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tierId: int()
      .notNull()
      .references(() => subscriptionTiers.id, { onDelete: "restrict" }),
    status: mysqlEnum(["active", "past_due", "cancelled", "paused", "trialing"])
      .default("active")
      .notNull(),
    billingCycle: mysqlEnum(["monthly", "yearly"]).default("monthly").notNull(),
    currentPeriodStart: datetime({ mode: "string" }),
    currentPeriodEnd: datetime({ mode: "string" }),
    trialStart: datetime({ mode: "string" }),
    trialEnd: datetime({ mode: "string" }),
    stripeCustomerId: varchar({ length: 100 }),
    stripeSubscriptionId: varchar({ length: 100 }),
    cancelAtPeriodEnd: tinyint().default(0).notNull(),
    cancelledAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("userId").on(table.userId)]
);

export const userPortfolioConfig = mysqlTable(
  "user_portfolio_config",
  {
    id: int().autoincrement().notNull(),
    userId: int().notNull(),
    portfolioName: varchar({ length: 100 }).default("My Portfolio"),
    startingCapital: int().default(10000000).notNull(),
    currentCapital: int(),
    maxPortfolioDrawdown: decimal({ precision: 5, scale: 2 }).default("25.00"),
    maxDailyLoss: decimal({ precision: 10, scale: 2 }),
    maxCorrelation: decimal({ precision: 3, scale: 2 }).default("0.70"),
    maxLeverage: decimal({ precision: 5, scale: 2 }).default("1.00"),
    marginRequirement: decimal({ precision: 5, scale: 2 }).default("25.00"),
    defaultTimeRange: mysqlEnum(["YTD", "1Y", "3Y", "5Y", "ALL"]).default("1Y"),
    showBenchmark: tinyint().default(1).notNull(),
    benchmarkSymbol: varchar({ length: 20 }).default("SPY"),
    emailAlerts: tinyint().default(1).notNull(),
    drawdownAlertThreshold: decimal({ precision: 5, scale: 2 }).default(
      "10.00"
    ),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("userId").on(table.userId)]
);

export const userSignals = mysqlTable(
  "user_signals",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    webhookLogId: int()
      .notNull()
      .references(() => webhookLogs.id, { onDelete: "cascade" }),
    strategyId: int()
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    direction: varchar({ length: 10 }).notNull(),
    price: int().notNull(),
    quantity: int().notNull(),
    action: mysqlEnum(["pending", "executed", "skipped", "expired"])
      .default("pending")
      .notNull(),
    executionLogId: int(),
    signalReceivedAt: datetime({ mode: "string" }).notNull(),
    actionTakenAt: datetime({ mode: "string" }),
    expiresAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [
    index("idx_user_strategy").on(table.userId, table.strategyId),
    index("idx_action").on(table.action),
  ]
);

export const userStrategySettings = mysqlTable(
  "user_strategy_settings",
  {
    id: int().autoincrement().notNull(),
    userId: int().notNull(),
    strategyId: int().notNull(),
    positionSizeType: mysqlEnum(["fixed", "percent_equity", "risk_based"])
      .default("fixed")
      .notNull(),
    fixedContracts: int().default(1),
    percentEquity: decimal({ precision: 5, scale: 2 }).default("2.00"),
    riskPerTrade: decimal({ precision: 5, scale: 2 }).default("1.00"),
    maxContracts: int().default(10),
    varianceEnabled: tinyint().default(0).notNull(),
    varianceMultiplier: decimal({ precision: 5, scale: 2 }).default("1.00"),
    targetVolatility: decimal({ precision: 5, scale: 2 }).default("15.00"),
    equityWeight: decimal({ precision: 5, scale: 2 }).default("100.00"),
    rebalanceFrequency: mysqlEnum([
      "daily",
      "weekly",
      "monthly",
      "quarterly",
    ]).default("monthly"),
    maxDrawdownLimit: decimal({ precision: 5, scale: 2 }).default("20.00"),
    dailyLossLimit: decimal({ precision: 10, scale: 2 }),
    maxConsecutiveLosses: int().default(5),
    contractType: mysqlEnum(["mini", "micro"]).default("mini").notNull(),
    showInDashboard: tinyint().default(1).notNull(),
    displayColor: varchar({ length: 7 }).default("#60a5fa"),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("unique_user_strategy").on(table.userId, table.strategyId)]
);

export const userSubscriptions = mysqlTable(
  "user_subscriptions",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    strategyId: int()
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
    notificationsEnabled: tinyint().default(1).notNull(),
    autoExecuteEnabled: tinyint().default(0).notNull(),
    quantityMultiplier: decimal({ precision: 10, scale: 4 }).default("1.0000"),
    maxPositionSize: int(),
    subscribedAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
    accountValue: int().default(100000),
    useLeveraged: tinyint().default(0).notNull(),
  },
  table => [index("unique_user_strategy").on(table.userId, table.strategyId)]
);

export const users = mysqlTable(
  "users",
  {
    id: int().autoincrement().notNull(),
    openId: varchar({ length: 64 }),
    name: text(),
    email: varchar({ length: 320 }).notNull().unique(),
    passwordHash: varchar({ length: 255 }),
    loginMethod: varchar({ length: 64 }).default("password").notNull(),
    role: mysqlEnum(["user", "admin"]).default("user").notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
    lastSignedIn: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    subscriptionTier: mysqlEnum(["free", "pro", "premium"])
      .default("free")
      .notNull(),
    stripeCustomerId: varchar({ length: 255 }),
    stripeSubscriptionId: varchar({ length: 255 }),
    subscriptionStatus: varchar({ length: 50 }).default("active").notNull(),
    onboardingCompleted: tinyint().default(0).notNull(),
    onboardingDismissed: tinyint().default(0).notNull(),
    startingCapital: int().default(100000).notNull(),
    contractSize: mysqlEnum(["mini", "micro"]).default("micro").notNull(),
    freeAlertsRemaining: int().default(10).notNull(),
    freeTrialStartedAt: timestamp({ mode: "string" }),
    freeTrialExhaustedAt: timestamp({ mode: "string" }),
    rememberToken: varchar({ length: 255 }),
    rememberTokenExpiresAt: timestamp({ mode: "string" }),
    passwordResetToken: varchar({ length: 255 }),
    passwordResetExpires: timestamp({ mode: "string" }),
    accountSize: decimal({ precision: 12, scale: 2 }),
    riskPercentage: decimal({ precision: 5, scale: 2 }).default("1.00"),
    themePreference: mysqlEnum("theme_preference", ["light", "dark"])
      .default("light")
      .notNull(),
  },
  table => [
    index("users_email_unique").on(table.email),
    index("users_openId_unique").on(table.openId),
    index("users_role").on(table.role),
  ]
);

export const waitlist = mysqlTable(
  "waitlist",
  {
    id: int().autoincrement().notNull(),
    email: varchar({ length: 320 }).notNull(),
    status: mysqlEnum(["pending", "converted", "unsubscribed"])
      .default("pending")
      .notNull(),
    source: varchar({ length: 50 }).default("homepage").notNull(),
    convertedAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_waitlist_email").on(table.email),
    index("idx_waitlist_status").on(table.status),
    index("email").on(table.email),
  ]
);

export const webhookLogs = mysqlTable(
  "webhook_logs",
  {
    id: int().autoincrement().notNull(),
    strategyId: int(),
    strategySymbol: varchar({ length: 50 }),
    payload: text().notNull(),
    status: mysqlEnum([
      "pending",
      "processing",
      "success",
      "failed",
      "duplicate",
    ])
      .default("pending")
      .notNull(),
    errorMessage: text(),
    tradeId: int(),
    direction: varchar({ length: 10 }),
    entryPrice: int(),
    exitPrice: int(),
    pnl: int(),
    entryTime: datetime({ mode: "string" }),
    exitTime: datetime({ mode: "string" }),
    ipAddress: varchar({ length: 45 }),
    processingTimeMs: int(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    isTest: tinyint().default(0).notNull(),
  },
  table => [
    index("idx_webhook_logs_strategy").on(table.strategyId),
    index("idx_webhook_logs_status").on(table.status),
    index("idx_webhook_logs_created").on(table.createdAt),
    index("idx_webhook_logs_strategy_created").on(
      table.strategyId,
      table.createdAt
    ),
    index("idx_webhook_logs_status_created").on(table.status, table.createdAt),
  ]
);

export const webhookQueue = mysqlTable(
  "webhook_queue",
  {
    id: int().autoincrement().notNull(),
    payload: text().notNull(),
    ipAddress: varchar({ length: 45 }),
    status: mysqlEnum(["pending", "processing", "completed", "failed", "dead"])
      .default("pending")
      .notNull(),
    attempts: int().default(0).notNull(),
    maxAttempts: int().default(5).notNull(),
    nextRetryAt: datetime({ mode: "string" }),
    lastError: text(),
    webhookLogId: int(),
    receivedAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    startedAt: datetime({ mode: "string" }),
    completedAt: datetime({ mode: "string" }),
    processingTimeMs: int(),
    correlationId: varchar({ length: 50 }),
  },
  table => [
    index("idx_status").on(table.status),
    index("idx_next_retry").on(table.nextRetryAt),
  ]
);

export const webhookRetryQueue = mysqlTable(
  "webhook_retry_queue",
  {
    id: int().autoincrement().notNull(),
    originalPayload: text().notNull(),
    correlationId: varchar({ length: 50 }).notNull(),
    strategySymbol: varchar({ length: 20 }),
    retryCount: int().default(0).notNull(),
    maxRetries: int().default(5).notNull(),
    nextRetryAt: datetime({ mode: "string" }).notNull(),
    lastError: text(),
    status: mysqlEnum([
      "pending",
      "processing",
      "completed",
      "failed",
      "cancelled",
    ])
      .default("pending")
      .notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
    completedAt: datetime({ mode: "string" }),
  },
  table => [
    index("idx_retry_queue_status").on(table.status),
    index("idx_retry_queue_next_retry").on(table.nextRetryAt),
    index("idx_retry_queue_correlation").on(table.correlationId),
  ]
);

export const webhookWal = mysqlTable(
  "webhook_wal",
  {
    id: int().autoincrement().notNull(),
    walId: varchar({ length: 64 }).notNull(),
    correlationId: varchar({ length: 64 }).notNull(),
    rawPayload: text().notNull(),
    strategySymbol: varchar({ length: 50 }),
    action: varchar({ length: 20 }),
    direction: varchar({ length: 10 }),
    price: int(),
    quantity: int(),
    status: mysqlEnum([
      "received",
      "processing",
      "completed",
      "failed",
      "retrying",
    ])
      .default("received")
      .notNull(),
    attempts: int().default(0).notNull(),
    lastAttemptAt: datetime({ mode: "string" }),
    completedAt: datetime({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
    resultWebhookLogId: int(),
    errorMessage: text(),
    sourceIp: varchar({ length: 45 }),
    userAgent: varchar({ length: 255 }),
    receivedAt: datetime({ mode: "string" }).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [
    index("idx_webhook_wal_wal_id").on(table.walId),
    index("idx_webhook_wal_status").on(table.status),
    index("idx_webhook_wal_correlation").on(table.correlationId),
    index("idx_webhook_wal_received_at").on(table.receivedAt),
  ]
);

export const userPreferences = mysqlTable(
  "user_preferences",
  {
    id: int().autoincrement().notNull(),
    userId: int()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    contractSize: mysqlEnum(["mini", "micro"]).default("mini").notNull(),
    accountValue: int().default(100000).notNull(),
    theme: mysqlEnum(["light", "dark"]).default("light").notNull(),
    timezone: varchar({ length: 100 }).default("America/New_York").notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  table => [index("idx_user_preferences_user").on(table.userId)]
);

// Type exports for insert operations
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;
export type InsertOpenPosition = typeof openPositions.$inferInsert;
export type OpenPosition = typeof openPositions.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertNotificationPreference =
  typeof notificationPreferences.$inferInsert;
export type NotificationPreference =
  typeof notificationPreferences.$inferSelect;
export type StrategyNotificationSetting =
  typeof strategyNotificationSettings.$inferSelect;
export type StagingTrade = typeof stagingTrades.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;
export type ContactResponse = typeof contactResponses.$inferSelect;
export type InsertContactResponse = typeof contactResponses.$inferInsert;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type PaperPosition = typeof paperPositions.$inferSelect;
export type PaperAccount = typeof paperAccounts.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;
