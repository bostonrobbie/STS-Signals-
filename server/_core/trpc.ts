import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { Permission, roleHasPermission } from "../core/rbacMiddleware";
import {
  requireSubscription,
  type SubscriptionRequirement,
  // @ts-expect-error TS6133 unused
  getUserSubscriptionTier,
} from "./subscriptionMiddleware";

// Error messages
const UNAUTHED_ERR_MSG = "You must be logged in to access this resource";
const NOT_ADMIN_ERR_MSG = "You must be an admin to access this resource";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * Create a permission-based procedure that enforces specific permissions
 */
export const createPermissionProcedure = (
  permission: Permission | Permission[]
) => {
  return protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      const permissions = Array.isArray(permission) ? permission : [permission];
      const hasPermission = permissions.some(p =>
        // @ts-expect-error TS2345, TS18047
        roleHasPermission(ctx.user.role, p)
      );

      if (!hasPermission) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Insufficient permissions. Required: ${permissions.join(", ")}`,
        });
      }

      return next({ ctx });
    })
  );
};

// Permission-based procedures for common operations
export const viewAnalyticsProcedure = createPermissionProcedure(
  Permission.VIEW_ANALYTICS
);
export const createStrategyProcedure = createPermissionProcedure(
  Permission.CREATE_STRATEGY
);
export const updateStrategyProcedure = createPermissionProcedure(
  Permission.UPDATE_STRATEGY
);
export const deleteStrategyProcedure = createPermissionProcedure(
  Permission.DELETE_STRATEGY
);
export const manageTradeProcedure = createPermissionProcedure(
  Permission.MANAGE_TRADES
);
export const exportDataProcedure = createPermissionProcedure(
  Permission.EXPORT_DATA
);
export const manageSystemProcedure = createPermissionProcedure(
  Permission.MANAGE_SYSTEM
);
export const manageCredentialsProcedure = createPermissionProcedure(
  Permission.MANAGE_CREDENTIALS
);

/**
 * Create a subscription-tier-based procedure
 */
export const createSubscriptionProcedure = (
  requirement: SubscriptionRequirement
) => {
  return protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      requireSubscription(ctx.user, requirement);

      return next({ ctx });
    })
  );
};

// Common subscription-tier procedures
export const proProcedure = createSubscriptionProcedure({ tier: "pro" });
export const enterpriseProcedure = createSubscriptionProcedure({
  tier: "enterprise",
});

// Feature-specific procedures
export const webhookProcedure = createSubscriptionProcedure({
  tier: "pro",
  feature: "canReceiveWebhooks",
});
export const alertsProcedure = createSubscriptionProcedure({
  tier: "pro",
  feature: "canUseRealTimeAlerts",
});
export const analyticsProcedure = createSubscriptionProcedure({
  tier: "pro",
  feature: "canAccessAdvancedAnalytics",
});
export const apiProcedure = createSubscriptionProcedure({
  tier: "pro",
  feature: "canAccessAPI",
});
export const compareProcedure = createSubscriptionProcedure({
  tier: "pro",
  feature: "canCompareStrategies",
});
