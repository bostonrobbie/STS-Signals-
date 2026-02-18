// @ts-expect-error TS7016
import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 12;
const REMEMBER_TOKEN_EXPIRY_DAYS = 30;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure remember token
 */
export function generateRememberToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate remember token expiry date (30 days from now)
 */
export function getRememberTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REMEMBER_TOKEN_EXPIRY_DAYS);
  return expiry;
}

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
