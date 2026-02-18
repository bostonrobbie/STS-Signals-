import { router, adminProcedure } from "../_core/trpc";
// @ts-expect-error TS2614
import { adminDashboard } from "../core/adminDashboard";
// @ts-expect-error TS2614
import { auditTrail } from "../core/auditTrail";
// @ts-expect-error TS2724
import { featureFlags } from "../core/featureFlags";
import { logger } from "../core/logger";
import { z } from "zod";

/**
 * Admin Router
 * Protected routes for administrative operations
 * Requires admin role for all endpoints
 */

export const adminRouter = router({
  /**
   * Get system statistics and metrics
   */
  getStats: adminProcedure.query(async () => {
    try {
      const stats = await adminDashboard.getAdminStats();
      return { success: true, data: stats };
    } catch (error) {
      logger.error("Failed to get admin stats", error);
      throw error;
    }
  }),

  /**
   * Get system health metrics
   */
  getHealth: adminProcedure.query(async () => {
    try {
      const health = await adminDashboard.getSystemHealthMetrics();
      return { success: true, data: health };
    } catch (error) {
      logger.error("Failed to get system health", error);
      throw error;
    }
  }),

  /**
   * Pause a strategy
   */
  pauseStrategy: adminProcedure
    .input(z.object({ strategyId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.pauseStrategy(input.strategyId);
        await auditTrail.logSystemAction("PAUSE_STRATEGY", "strategy", {
          strategyId: input.strategyId,
        });
        return { success: result };
      } catch (error) {
        logger.error(`Failed to pause strategy ${input.strategyId}`, error);
        throw error;
      }
    }),

  /**
   * Resume a strategy
   */
  resumeStrategy: adminProcedure
    .input(z.object({ strategyId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.resumeStrategy(input.strategyId);
        await auditTrail.logSystemAction("RESUME_STRATEGY", "strategy", {
          strategyId: input.strategyId,
        });
        return { success: result };
      } catch (error) {
        logger.error(`Failed to resume strategy ${input.strategyId}`, error);
        throw error;
      }
    }),

  /**
   * Delete a trade
   */
  deleteTrade: adminProcedure
    .input(z.object({ tradeId: z.number(), userId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.deleteTrade(
          input.tradeId,
          input.userId
        );
        await auditTrail.logSystemAction("DELETE_TRADE", "trade", {
          tradeId: input.tradeId,
          userId: input.userId,
        });
        return { success: result };
      } catch (error) {
        logger.error(`Failed to delete trade ${input.tradeId}`, error);
        throw error;
      }
    }),

  /**
   * Delete multiple trades
   */
  deleteMultipleTrades: adminProcedure
    .input(z.object({ tradeIds: z.array(z.number()), userId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const deleted = await adminDashboard.deleteMultipleTrades(
          input.tradeIds,
          input.userId
        );
        await auditTrail.logSystemAction("DELETE_MULTIPLE_TRADES", "trade", {
          count: deleted,
          userId: input.userId,
        });
        return { success: true, deleted };
      } catch (error) {
        logger.error("Failed to delete multiple trades", error);
        throw error;
      }
    }),

  /**
   * Mark trade as erroneous
   */
  markTradeAsErroneous: adminProcedure
    .input(z.object({ tradeId: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.markTradeAsErroneous(
          input.tradeId,
          input.reason
        );
        await auditTrail.logSystemAction("MARK_TRADE_ERRONEOUS", "trade", {
          tradeId: input.tradeId,
          reason: input.reason,
        });
        return { success: result };
      } catch (error) {
        logger.error(
          `Failed to mark trade as erroneous ${input.tradeId}`,
          error
        );
        throw error;
      }
    }),

  /**
   * Get erroneous trades
   */
  getErroneousTrades: adminProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      try {
        const trades = await adminDashboard.getErroneousTrades(input?.userId);
        return { success: true, data: trades };
      } catch (error) {
        logger.error("Failed to get erroneous trades", error);
        throw error;
      }
    }),

  /**
   * Check data quality
   */
  checkDataQuality: adminProcedure.query(async () => {
    try {
      const report = await adminDashboard.checkDataQuality();
      return { success: true, data: report };
    } catch (error) {
      logger.error("Failed to check data quality", error);
      throw error;
    }
  }),

  /**
   * Clean erroneous data
   */
  cleanErroneousData: adminProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.cleanErroneousData(input.dryRun);
        await auditTrail.logSystemAction("CLEAN_ERRONEOUS_DATA", "data", {
          dryRun: input.dryRun,
          deleted: result.deleted,
        });
        return { success: true, ...result };
      } catch (error) {
        logger.error("Failed to clean erroneous data", error);
        throw error;
      }
    }),

  /**
   * Export admin report
   */
  exportReport: adminProcedure
    .input(z.object({ format: z.enum(["json", "csv"]).default("json") }))
    .query(async ({ input }) => {
      try {
        const report = await adminDashboard.exportAdminReport(input.format);
        return { success: true, data: report };
      } catch (error) {
        logger.error("Failed to export admin report", error);
        throw error;
      }
    }),

  /**
   * Get user activity log
   */
  getUserActivityLog: adminProcedure
    .input(z.object({ userId: z.string(), limit: z.number().default(100) }))
    .query(async ({ input }) => {
      try {
        const logs = await adminDashboard.getUserActivityLog(
          input.userId,
          input.limit
        );
        return { success: true, data: logs };
      } catch (error) {
        logger.error(
          `Failed to get activity log for user ${input.userId}`,
          error
        );
        throw error;
      }
    }),

  /**
   * Get system audit log
   */
  getSystemAuditLog: adminProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input }) => {
      try {
        const logs = await adminDashboard.getSystemAuditLog(input.limit);
        return { success: true, data: logs };
      } catch (error) {
        logger.error("Failed to get system audit log", error);
        throw error;
      }
    }),

  /**
   * Disable user account
   */
  disableUserAccount: adminProcedure
    .input(z.object({ userId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.disableUserAccount(
          input.userId,
          input.reason
        );
        await auditTrail.logSystemAction("DISABLE_USER_ACCOUNT", "user", {
          userId: input.userId,
          reason: input.reason,
        });
        return { success: result };
      } catch (error) {
        logger.error(`Failed to disable user account ${input.userId}`, error);
        throw error;
      }
    }),

  /**
   * Enable user account
   */
  enableUserAccount: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.enableUserAccount(input.userId);
        await auditTrail.logSystemAction("ENABLE_USER_ACCOUNT", "user", {
          userId: input.userId,
        });
        return { success: result };
      } catch (error) {
        logger.error(`Failed to enable user account ${input.userId}`, error);
        throw error;
      }
    }),

  /**
   * Reset user data
   */
  resetUserData: adminProcedure
    .input(z.object({ userId: z.string(), dryRun: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      try {
        const result = await adminDashboard.resetUserData(
          input.userId,
          input.dryRun
        );
        await auditTrail.logSystemAction("RESET_USER_DATA", "user", {
          userId: input.userId,
          dryRun: input.dryRun,
        });
        return { success: result };
      } catch (error) {
        logger.error(`Failed to reset user data for ${input.userId}`, error);
        throw error;
      }
    }),

  /**
   * Audit Trail Routes
   */
  audit: router({
    /**
     * Search audit logs
     */
    search: adminProcedure
      .input(
        z.object({
          userId: z.string().optional(),
          action: z.string().optional(),
          resource: z.string().optional(),
          status: z.enum(["success", "failure"]).optional(),
          limit: z.number().default(100),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        try {
          const logs = await auditTrail.searchAuditLogs(input);
          return { success: true, data: logs };
        } catch (error) {
          logger.error("Failed to search audit logs", error);
          throw error;
        }
      }),

    /**
     * Generate audit report
     */
    report: adminProcedure
      .input(
        z.object({
          userId: z.string().optional(),
          action: z.string().optional(),
          resource: z.string().optional(),
          limit: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        try {
          const report = await auditTrail.generateAuditReport(input);
          return { success: true, data: report };
        } catch (error) {
          logger.error("Failed to generate audit report", error);
          throw error;
        }
      }),

    /**
     * Export audit logs
     */
    export: adminProcedure
      .input(
        z.object({
          userId: z.string().optional(),
          format: z.enum(["json", "csv"]).default("json"),
          limit: z.number().default(1000),
        })
      )
      .query(async ({ input }) => {
        try {
          const exported = await auditTrail.exportAuditLogs(
            { userId: input.userId, limit: input.limit },
            input.format
          );
          return { success: true, data: exported };
        } catch (error) {
          logger.error("Failed to export audit logs", error);
          throw error;
        }
      }),
  }),

  /**
   * Feature Flags Routes
   */
  flags: router({
    /**
     * Get all feature flags
     */
    getAll: adminProcedure.query(async () => {
      try {
        const flags = await featureFlags.getAllFeatureFlags();
        return { success: true, data: flags };
      } catch (error) {
        logger.error("Failed to get feature flags", error);
        throw error;
      }
    }),

    /**
     * Get feature flag report
     */
    report: adminProcedure.query(async () => {
      try {
        const report = await featureFlags.getFeatureFlagReport();
        return { success: true, data: report };
      } catch (error) {
        logger.error("Failed to get feature flag report", error);
        throw error;
      }
    }),

    /**
     * Enable feature flag
     */
    enable: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await featureFlags.enableFeatureFlag(input.name);
          await auditTrail.logSystemAction("ENABLE_FEATURE_FLAG", "feature", {
            flagName: input.name,
          });
          return { success: result };
        } catch (error) {
          logger.error(`Failed to enable feature flag ${input.name}`, error);
          throw error;
        }
      }),

    /**
     * Disable feature flag
     */
    disable: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await featureFlags.disableFeatureFlag(input.name);
          await auditTrail.logSystemAction("DISABLE_FEATURE_FLAG", "feature", {
            flagName: input.name,
          });
          return { success: result };
        } catch (error) {
          logger.error(`Failed to disable feature flag ${input.name}`, error);
          throw error;
        }
      }),

    /**
     * Set rollout percentage
     */
    setRollout: adminProcedure
      .input(
        z.object({ name: z.string(), percentage: z.number().min(0).max(100) })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await featureFlags.setRolloutPercentage(
            input.name,
            input.percentage
          );
          await auditTrail.logSystemAction("SET_FEATURE_ROLLOUT", "feature", {
            flagName: input.name,
            percentage: input.percentage,
          });
          return { success: result };
        } catch (error) {
          logger.error(`Failed to set rollout for ${input.name}`, error);
          throw error;
        }
      }),

    /**
     * Add target user
     */
    addTargetUser: adminProcedure
      .input(z.object({ flagName: z.string(), userId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await featureFlags.addTargetUser(
            input.flagName,
            input.userId
          );
          await auditTrail.logSystemAction(
            "ADD_FEATURE_TARGET_USER",
            "feature",
            {
              flagName: input.flagName,
              userId: input.userId,
            }
          );
          return { success: result };
        } catch (error) {
          logger.error(
            `Failed to add target user for ${input.flagName}`,
            error
          );
          throw error;
        }
      }),

    /**
     * Remove target user
     */
    removeTargetUser: adminProcedure
      .input(z.object({ flagName: z.string(), userId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const result = await featureFlags.removeTargetUser(
            input.flagName,
            input.userId
          );
          await auditTrail.logSystemAction(
            "REMOVE_FEATURE_TARGET_USER",
            "feature",
            {
              flagName: input.flagName,
              userId: input.userId,
            }
          );
          return { success: result };
        } catch (error) {
          logger.error(
            `Failed to remove target user for ${input.flagName}`,
            error
          );
          throw error;
        }
      }),
  }),
});

export default adminRouter;
