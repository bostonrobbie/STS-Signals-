import crypto from 'crypto';
import { ENV } from '../_core/env';

/**
 * Encryption utility for sensitive data storage
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derives a 256-bit key from the JWT_SECRET using PBKDF2
 * This ensures we have a proper length key for AES-256
 */
function deriveKey(salt: Buffer): Buffer {
  // Use JWT_SECRET as the base for encryption key
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error('JWT_SECRET is required for encryption');
  }
  
  // PBKDF2 with 100,000 iterations for key derivation
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

/**
 * Encrypts a string value using AES-256-GCM
 * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from secret + salt
  const key = deriveKey(salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded encrypted string
 * Expects format: salt + iv + authTag + ciphertext
 */
export function decrypt(encryptedBase64: string): string {
  if (!encryptedBase64) return '';
  
  try {
    const combined = Buffer.from(encryptedBase64, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Derive key from secret + salt
    const key = deriveKey(salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data - data may be corrupted or key mismatch');
  }
}

/**
 * Checks if a string appears to be encrypted (base64 with correct length)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  try {
    const decoded = Buffer.from(value, 'base64');
    // Minimum length: salt(32) + iv(16) + authTag(16) + at least 1 byte of data
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Encrypts an object (JSON serializable) and returns encrypted string
 */
export function encryptObject<T>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts an encrypted string and parses as JSON object
 */
export function decryptObject<T>(encryptedBase64: string): T {
  const json = decrypt(encryptedBase64);
  return JSON.parse(json) as T;
}

/**
 * Hash a value using SHA-256 (one-way, for comparison purposes)
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
