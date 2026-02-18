/**
 * Encryption Service for Broker Credentials
 *
 * Uses AES-256-GCM for secure encryption of sensitive data like API keys.
 * Each encryption generates a unique IV for maximum security.
 */

import crypto from "crypto";
import { ENV } from "./_core/env";

// Use JWT_SECRET as the base for encryption key (32 bytes for AES-256)
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(ENV.cookieSecret)
  .digest();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
// Auth tag is automatically 16 bytes (128 bits) for GCM

export interface EncryptedData {
  iv: string; // Base64 encoded IV
  data: string; // Base64 encoded encrypted data
  tag: string; // Base64 encoded auth tag
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @returns Encrypted data object with IV, ciphertext, and auth tag
 */
export function encrypt(plaintext: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    data: encrypted,
    tag: authTag.toString("base64"),
  };
}

/**
 * Decrypts data that was encrypted with the encrypt function
 * @param encryptedData - The encrypted data object
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: EncryptedData): string {
  const iv = Buffer.from(encryptedData.iv, "base64");
  const authTag = Buffer.from(encryptedData.tag, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.data, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypts a JSON object
 * @param data - Object to encrypt
 * @returns Encrypted string (JSON stringified EncryptedData)
 */
export function encryptObject<T extends object>(data: T): string {
  const plaintext = JSON.stringify(data);
  const encrypted = encrypt(plaintext);
  return JSON.stringify(encrypted);
}

/**
 * Decrypts a JSON object
 * @param encryptedString - Encrypted string from encryptObject
 * @returns Decrypted object
 */
export function decryptObject<T extends object>(encryptedString: string): T {
  const encryptedData: EncryptedData = JSON.parse(encryptedString);
  const plaintext = decrypt(encryptedData);
  return JSON.parse(plaintext) as T;
}

/**
 * Broker credential types for each supported broker
 */
export interface TradovateCredentials {
  username: string;
  password: string;
  appId: string;
  appVersion: string;
  cid: string; // Client ID
  sec: string; // Client Secret
  deviceId: string;
  isDemo: boolean;
}

export interface IBKRCredentials {
  username: string;
  password: string;
  accountId: string;
  // IBKR uses session-based auth via Client Portal Gateway
  gatewayHost?: string; // Default: localhost:5000
}

export interface TradeStationCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiration?: string; // ISO date string
  isSimulated: boolean;
}

export type BrokerCredentials =
  | { broker: "tradovate"; credentials: TradovateCredentials }
  | { broker: "ibkr"; credentials: IBKRCredentials }
  | { broker: "tradestation"; credentials: TradeStationCredentials };

/**
 * Encrypts broker credentials for storage
 */
export function encryptBrokerCredentials(
  credentials: BrokerCredentials
): string {
  return encryptObject(credentials);
}

/**
 * Decrypts broker credentials from storage
 */
export function decryptBrokerCredentials(
  encryptedString: string
): BrokerCredentials {
  return decryptObject<BrokerCredentials>(encryptedString);
}

/**
 * Validates that credentials have required fields
 */
export function validateCredentials(
  broker: string,
  credentials: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (broker) {
    case "tradovate":
      if (!credentials.username) errors.push("Username is required");
      if (!credentials.password) errors.push("Password is required");
      if (!credentials.appId) errors.push("App ID is required");
      if (!credentials.cid) errors.push("Client ID is required");
      if (!credentials.sec) errors.push("Client Secret is required");
      break;

    case "ibkr":
      if (!credentials.username) errors.push("Username is required");
      if (!credentials.password) errors.push("Password is required");
      if (!credentials.accountId) errors.push("Account ID is required");
      break;

    case "tradestation":
      if (!credentials.clientId) errors.push("Client ID is required");
      if (!credentials.clientSecret) errors.push("Client Secret is required");
      break;

    default:
      errors.push(`Unknown broker: ${broker}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Masks sensitive data for display (shows only last 4 chars)
 */
export function maskCredential(value: string): string {
  if (!value || value.length <= 4) return "****";
  return "*".repeat(value.length - 4) + value.slice(-4);
}
