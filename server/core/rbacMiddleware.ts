/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces permission checks on protected endpoints
 */

import { Request, Response, NextFunction } from "express";
// @ts-expect-error TS6133 unused
import { UserRole, hasPermission, ROLE_PERMISSIONS } from "./security";

/**
 * Extend Express Request to include user role
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Permission types for different operations
 */
export enum Permission {
  // User management
  MANAGE_USERS = "manage_users",
  MANAGE_ROLES = "manage_roles",
  VIEW_USERS = "view_users",

  // Strategy management
  CREATE_STRATEGY = "create_strategy",
  UPDATE_STRATEGY = "update_strategy",
  DELETE_STRATEGY = "delete_strategy",
  MANAGE_STRATEGIES = "manage_strategies",

  // Trade management
  CREATE_TRADE = "create_trade",
  UPDATE_TRADE = "update_trade",
  DELETE_TRADE = "delete_trade",
  MANAGE_TRADES = "manage_trades",

  // Analytics and reporting
  VIEW_ANALYTICS = "view_analytics",
  EXPORT_DATA = "export_data",
  VIEW_REPORTS = "view_reports",

  // System administration
  MANAGE_SYSTEM = "manage_system",
  VIEW_LOGS = "view_logs",
  MANAGE_WEBHOOKS = "manage_webhooks",
  MANAGE_CREDENTIALS = "manage_credentials",

  // Billing and payments
  MANAGE_BILLING = "manage_billing",
  VIEW_BILLING = "view_billing",

  // Public access
  VIEW_PUBLIC_API = "view_public_api",
}

/**
 * Require authentication middleware
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  next();
}

/**
 * Require specific permission middleware
 */
export function requirePermission(permission: Permission | Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasRequiredPermission = permissions.some(p =>
      hasPermission(req.user!.role, p)
    );

    if (!hasRequiredPermission) {
      res.status(403).json({
        error: "Forbidden",
        message: `Insufficient permissions. Required: ${permissions.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific role middleware
 */
export function requireRole(role: UserRole | UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    const roles = Array.isArray(role) ? role : [role];

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Insufficient role. Required: ${roles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require admin role middleware
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  if (req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      error: "Forbidden",
      message: "Admin role required",
    });
    return;
  }

  next();
}

/**
 * Owner-only access middleware
 * Allows access only if the user is the owner of the resource
 */
export function requireOwnerAccess(_resourceOwnerField: string = "userId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    // Get the owner ID from the request (could be from params, body, or query)
    const ownerId = req.params.userId || req.body?.userId || req.query?.userId;

    // Admin can access any resource
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // User can only access their own resources
    if (req.user.id.toString() !== ownerId?.toString()) {
      res.status(403).json({
        error: "Forbidden",
        message: "You can only access your own resources",
      });
      return;
    }

    next();
  };
}

/**
 * Rate limit by role middleware
 * Different rate limits for different roles
 */
export function rateLimitByRole(limits: Record<UserRole, number>) {
  const store = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const key = `${req.user.id}:${req.path}`;
    const limit = limits[req.user.role] || 100;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + 60000 }; // 1 minute window
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    if (entry.count > limit) {
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded for ${req.user.role} role`,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Audit logging middleware
 * Logs all access to sensitive endpoints
 */
export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function (data: any) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        action,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ipAddress: req.ip,
      };

      // Log to console (in production, this would go to a logging service)
      console.log("[AUDIT]", JSON.stringify(logEntry));

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Permission matrix for different roles
 * Maps UserRole to their permissions
 */
export const PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.VIEW_USERS,
    Permission.CREATE_STRATEGY,
    Permission.UPDATE_STRATEGY,
    Permission.DELETE_STRATEGY,
    Permission.MANAGE_STRATEGIES,
    Permission.CREATE_TRADE,
    Permission.UPDATE_TRADE,
    Permission.DELETE_TRADE,
    Permission.MANAGE_TRADES,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_SYSTEM,
    Permission.VIEW_LOGS,
    Permission.MANAGE_WEBHOOKS,
    Permission.MANAGE_CREDENTIALS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
    Permission.VIEW_PUBLIC_API,
  ],

  [UserRole.USER]: [
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.VIEW_REPORTS,
    Permission.CREATE_STRATEGY,
    Permission.UPDATE_STRATEGY,
    Permission.DELETE_STRATEGY,
    Permission.CREATE_TRADE,
    Permission.UPDATE_TRADE,
    Permission.DELETE_TRADE,
    Permission.VIEW_BILLING,
    Permission.VIEW_PUBLIC_API,
  ],

  [UserRole.READ_ONLY]: [
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_BILLING,
    Permission.VIEW_PUBLIC_API,
  ],
};

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return PERMISSION_MATRIX[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) || false;
}

/**
 * Get roles that have a specific permission
 */
export function getRolesWithPermission(permission: Permission): UserRole[] {
  return Object.entries(PERMISSION_MATRIX)
    .filter(([_, permissions]) => permissions.includes(permission))
    .map(([role]) => role as UserRole);
}
