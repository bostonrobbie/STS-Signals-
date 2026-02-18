/**
 * Security Utilities
 * Handles credential encryption, RBAC, and security best practices
 */

import crypto from "crypto";

// Role-based access control
export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  READ_ONLY = "read_only",
}

export interface RolePermissions {
  [UserRole.ADMIN]: string[];
  [UserRole.USER]: string[];
  [UserRole.READ_ONLY]: string[];
}

export const ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: [
    "manage_users",
    "manage_strategies",
    "manage_trades",
    "manage_webhooks",
    "view_analytics",
    "export_data",
    "manage_settings",
    "manage_broker_connections",
  ],
  [UserRole.USER]: [
    "view_analytics",
    "manage_trades",
    "manage_webhooks",
    "export_data",
    "manage_broker_connections",
  ],
  [UserRole.READ_ONLY]: ["view_analytics"],
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Credential Encryption/Decryption
 * Uses AES-256-GCM for authenticated encryption
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
// @ts-expect-error TS6133 unused
const _AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derive encryption key from master key
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new Error("ENCRYPTION_MASTER_KEY environment variable not set");
  }

  // Derive a consistent key from the master key
  return crypto
    .createHash("sha256")
    .update(masterKey)
    .digest()
    .slice(0, ENCRYPTION_KEY_LENGTH);
}

/**
 * Encrypt sensitive credentials
 */
export function encryptCredential(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("[Security] Encryption failed:", error);
    throw new Error("Failed to encrypt credential");
  }
}

/**
 * Decrypt sensitive credentials
 */
export function decryptCredential(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, ciphertext] = encrypted.split(":");

    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[Security] Decryption failed:", error);
    throw new Error("Failed to decrypt credential");
  }
}

/**
 * Hash password using bcrypt
 * Note: In production, use bcrypt package instead of this basic implementation
 */
export function hashPassword(password: string): string {
  // This is a placeholder - in production use bcrypt
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify password against hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, storedHash] = hash.split(":");
    const computedHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(
  token: string,
  sessionToken: string
): boolean {
  // In production, implement proper CSRF validation
  return token === sessionToken;
}

/**
 * Security headers for HTTP responses
 */
export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
};

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  API: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  WEBHOOK: { windowMs: 60 * 1000, max: 1000 }, // 1000 requests per minute
};
