/**
 * RBAC Middleware Tests
 * Tests for role-based access control and permission enforcement
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  requireAuth,
  requirePermission,
  requireRole,
  requireAdmin,
  requireOwnerAccess,
  Permission,
  getPermissionsForRole,
  roleHasPermission,
  getRolesWithPermission,
  PERMISSION_MATRIX,
} from "./rbacMiddleware";
import { UserRole } from "./security";

describe("RBAC Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let nextCalled: boolean;
  let statusCode: number;
  let responseData: any;

  beforeEach(() => {
    nextCalled = false;
    statusCode = 200;
    responseData = null;

    mockReq = {
      user: undefined,
      params: {},
      body: {},
      query: {},
      ip: "127.0.0.1",
    };

    mockRes = {
      status: function (code: number) {
        statusCode = code;
        return this;
      },
      json: function (data: any) {
        responseData = data;
        return this;
      },
    };

    mockNext = () => {
      nextCalled = true;
    };
  });

  describe("requireAuth", () => {
    it("should allow authenticated users", () => {
      mockReq.user = { id: 1, email: "test@example.com", role: UserRole.USER };

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it("should reject unauthenticated users", () => {
      mockReq.user = undefined;

      requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(responseData.error).toBe("Unauthorized");
    });
  });

  describe("requirePermission", () => {
    it("should allow users with required permission", () => {
      mockReq.user = { id: 1, email: "test@example.com", role: UserRole.ADMIN };

      const middleware = requirePermission(Permission.MANAGE_USERS);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it("should reject users without required permission", () => {
      mockReq.user = {
        id: 1,
        email: "test@example.com",
        role: UserRole.READ_ONLY,
      };

      const middleware = requirePermission(Permission.MANAGE_USERS);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(responseData.error).toBe("Forbidden");
    });

    it("should allow users with any of multiple permissions", () => {
      mockReq.user = { id: 1, email: "test@example.com", role: UserRole.USER };

      const middleware = requirePermission([
        Permission.VIEW_ANALYTICS,
        Permission.MANAGE_USERS,
      ]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it("should reject unauthenticated users", () => {
      mockReq.user = undefined;

      const middleware = requirePermission(Permission.MANAGE_USERS);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
    });
  });

  describe("requireRole", () => {
    it("should allow users with required role", () => {
      mockReq.user = { id: 1, email: "test@example.com", role: UserRole.ADMIN };

      const middleware = requireRole(UserRole.ADMIN);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it("should reject users with different role", () => {
      mockReq.user = { id: 1, email: "test@example.com", role: UserRole.USER };

      const middleware = requireRole(UserRole.ADMIN);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
    });

    it("should allow users with any of multiple roles", () => {
      mockReq.user = { id: 1, email: "test@example.com", role: UserRole.USER };

      const middleware = requireRole([UserRole.ADMIN, UserRole.USER]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });
  });

  describe("requireAdmin", () => {
    it("should allow admin users", () => {
      mockReq.user = {
        id: 1,
        email: "admin@example.com",
        role: UserRole.ADMIN,
      };

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it("should reject non-admin users", () => {
      mockReq.user = { id: 1, email: "user@example.com", role: UserRole.USER };

      requireAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(responseData.message).toBe("Admin role required");
    });
  });

  describe("requireOwnerAccess", () => {
    it("should allow users to access their own resources", () => {
      mockReq.user = {
        id: 123,
        email: "user@example.com",
        role: UserRole.USER,
      };
      mockReq.params = { userId: "123" };

      const middleware = requireOwnerAccess("userId");
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it("should reject users accessing others resources", () => {
      mockReq.user = {
        id: 123,
        email: "user@example.com",
        role: UserRole.USER,
      };
      mockReq.params = { userId: "456" };

      const middleware = requireOwnerAccess("userId");
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(responseData.message).toBe(
        "You can only access your own resources"
      );
    });

    it("should allow admins to access any resource", () => {
      mockReq.user = {
        id: 1,
        email: "admin@example.com",
        role: UserRole.ADMIN,
      };
      mockReq.params = { userId: "999" };

      const middleware = requireOwnerAccess("userId");
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(nextCalled).toBe(true);
    });
  });

  describe("Permission Matrix", () => {
    it("should have correct permissions for ADMIN role", () => {
      const adminPermissions = getPermissionsForRole(UserRole.ADMIN);

      expect(adminPermissions).toContain(Permission.MANAGE_USERS);
      expect(adminPermissions).toContain(Permission.MANAGE_STRATEGIES);
      expect(adminPermissions).toContain(Permission.MANAGE_SYSTEM);
      expect(adminPermissions.length).toBeGreaterThan(15);
    });

    it("should have correct permissions for USER role", () => {
      const userPermissions = getPermissionsForRole(UserRole.USER);

      expect(userPermissions).toContain(Permission.VIEW_ANALYTICS);
      expect(userPermissions).toContain(Permission.CREATE_STRATEGY);
      expect(userPermissions).not.toContain(Permission.MANAGE_USERS);
      expect(userPermissions).not.toContain(Permission.MANAGE_SYSTEM);
    });

    it("should have correct permissions for READ_ONLY role", () => {
      const readOnlyPermissions = getPermissionsForRole(UserRole.READ_ONLY);

      expect(readOnlyPermissions).toContain(Permission.VIEW_ANALYTICS);
      expect(readOnlyPermissions).not.toContain(Permission.CREATE_STRATEGY);
      expect(readOnlyPermissions).not.toContain(Permission.MANAGE_USERS);
    });
  });

  describe("Permission Helpers", () => {
    it("should check if role has permission", () => {
      expect(roleHasPermission(UserRole.ADMIN, Permission.MANAGE_USERS)).toBe(
        true
      );
      expect(roleHasPermission(UserRole.USER, Permission.MANAGE_USERS)).toBe(
        false
      );
      expect(
        roleHasPermission(UserRole.READ_ONLY, Permission.VIEW_ANALYTICS)
      ).toBe(true);
    });

    it("should get roles with specific permission", () => {
      const rolesWithViewAnalytics = getRolesWithPermission(
        Permission.VIEW_ANALYTICS
      );

      expect(rolesWithViewAnalytics).toContain(UserRole.ADMIN);
      expect(rolesWithViewAnalytics).toContain(UserRole.USER);
      expect(rolesWithViewAnalytics).toContain(UserRole.READ_ONLY);
    });

    it("should get roles with admin-only permission", () => {
      const rolesWithManageUsers = getRolesWithPermission(
        Permission.MANAGE_USERS
      );

      expect(rolesWithManageUsers).toEqual([UserRole.ADMIN]);
    });
  });

  describe("Permission Coverage", () => {
    it("should have all permissions defined in PERMISSION_MATRIX", () => {
      const allPermissions = Object.values(Permission);

      for (const permission of allPermissions) {
        const rolesWithPermission = getRolesWithPermission(permission);
        expect(rolesWithPermission.length).toBeGreaterThan(0);
      }
    });

    it("should ensure READ_ONLY has minimal permissions", () => {
      const readOnlyPermissions = getPermissionsForRole(UserRole.READ_ONLY);
      const userPermissions = getPermissionsForRole(UserRole.USER);
      const adminPermissions = getPermissionsForRole(UserRole.ADMIN);

      expect(readOnlyPermissions.length).toBeLessThan(userPermissions.length);
      expect(userPermissions.length).toBeLessThan(adminPermissions.length);
    });

    it("should ensure ADMIN has all permissions", () => {
      const adminPermissions = getPermissionsForRole(UserRole.ADMIN);
      const allPermissions = Object.values(Permission);

      for (const permission of allPermissions) {
        expect(adminPermissions).toContain(permission);
      }
    });
  });
});
