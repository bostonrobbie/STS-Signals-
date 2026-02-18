import { relations } from "drizzle-orm/relations";
import {
  users,
  brokerConnections,
  webhookLogs,
  executionLogs,
  notificationPreferences,
  strategies,
  openPositions,
  paymentHistory,
  routingRules,
  strategyNotificationSettings,
  trades,
  userPaymentSubscriptions,
  subscriptionTiers,
  userSignals,
  userSubscriptions,
} from "./schema";

export const brokerConnectionsRelations = relations(
  brokerConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [brokerConnections.userId],
      references: [users.id],
    }),
    executionLogs: many(executionLogs),
    routingRules: many(routingRules),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  brokerConnections: many(brokerConnections),
  notificationPreferences: many(notificationPreferences),
  paymentHistories: many(paymentHistory),
  routingRules: many(routingRules),
  strategyNotificationSettings: many(strategyNotificationSettings),
  userPaymentSubscriptions: many(userPaymentSubscriptions),
  userSignals: many(userSignals),
  userSubscriptions: many(userSubscriptions),
}));

export const executionLogsRelations = relations(executionLogs, ({ one }) => ({
  webhookLog: one(webhookLogs, {
    fields: [executionLogs.webhookLogId],
    references: [webhookLogs.id],
  }),
  brokerConnection: one(brokerConnections, {
    fields: [executionLogs.brokerConnectionId],
    references: [brokerConnections.id],
  }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ many }) => ({
  executionLogs: many(executionLogs),
  userSignals: many(userSignals),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export const openPositionsRelations = relations(openPositions, ({ one }) => ({
  strategy: one(strategies, {
    fields: [openPositions.strategyId],
    references: [strategies.id],
  }),
}));

export const strategiesRelations = relations(strategies, ({ many }) => ({
  openPositions: many(openPositions),
  strategyNotificationSettings: many(strategyNotificationSettings),
  trades: many(trades),
  userSignals: many(userSignals),
  userSubscriptions: many(userSubscriptions),
}));

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  user: one(users, {
    fields: [paymentHistory.userId],
    references: [users.id],
  }),
}));

export const routingRulesRelations = relations(routingRules, ({ one }) => ({
  user: one(users, {
    fields: [routingRules.userId],
    references: [users.id],
  }),
  brokerConnection: one(brokerConnections, {
    fields: [routingRules.brokerConnectionId],
    references: [brokerConnections.id],
  }),
}));

export const strategyNotificationSettingsRelations = relations(
  strategyNotificationSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [strategyNotificationSettings.userId],
      references: [users.id],
    }),
    strategy: one(strategies, {
      fields: [strategyNotificationSettings.strategyId],
      references: [strategies.id],
    }),
  })
);

export const tradesRelations = relations(trades, ({ one }) => ({
  strategy: one(strategies, {
    fields: [trades.strategyId],
    references: [strategies.id],
  }),
}));

export const userPaymentSubscriptionsRelations = relations(
  userPaymentSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPaymentSubscriptions.userId],
      references: [users.id],
    }),
    subscriptionTier: one(subscriptionTiers, {
      fields: [userPaymentSubscriptions.tierId],
      references: [subscriptionTiers.id],
    }),
  })
);

export const subscriptionTiersRelations = relations(
  subscriptionTiers,
  ({ many }) => ({
    userPaymentSubscriptions: many(userPaymentSubscriptions),
  })
);

export const userSignalsRelations = relations(userSignals, ({ one }) => ({
  user: one(users, {
    fields: [userSignals.userId],
    references: [users.id],
  }),
  webhookLog: one(webhookLogs, {
    fields: [userSignals.webhookLogId],
    references: [webhookLogs.id],
  }),
  strategy: one(strategies, {
    fields: [userSignals.strategyId],
    references: [strategies.id],
  }),
}));

export const userSubscriptionsRelations = relations(
  userSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userSubscriptions.userId],
      references: [users.id],
    }),
    strategy: one(strategies, {
      fields: [userSubscriptions.strategyId],
      references: [strategies.id],
    }),
  })
);
