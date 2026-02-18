import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptObject, decryptObject, isEncrypted, hash } from './encryption';

describe('Encryption Utilities', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(plaintext.length);
      
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      expect(encrypted).toBe('');
      
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Same message';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle special characters and unicode', () => {
      const plaintext = '🔐 Secure data with émojis & spëcial chars! 中文';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptObject/decryptObject', () => {
    it('should encrypt and decrypt an object', () => {
      const obj = {
        accessToken: 'abc123',
        refreshToken: 'xyz789',
        expiresAt: 1234567890
      };
      
      const encrypted = encryptObject(obj);
      const decrypted = decryptObject<typeof obj>(encrypted);
      
      expect(decrypted).toEqual(obj);
    });

    it('should handle nested objects', () => {
      const obj = {
        credentials: {
          apiKey: 'secret-key',
          apiSecret: 'secret-value'
        },
        settings: {
          enabled: true,
          count: 42
        }
      };
      
      const encrypted = encryptObject(obj);
      const decrypted = decryptObject<typeof obj>(encrypted);
      
      expect(decrypted).toEqual(obj);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted strings', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain strings', () => {
      expect(isEncrypted('plain text')).toBe(false);
      expect(isEncrypted('')).toBe(false);
      expect(isEncrypted('short')).toBe(false);
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same input', () => {
      const value = 'test-value';
      const hash1 = hash(value);
      const hash2 = hash(value);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hash('value1');
      const hash2 = hash('value2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string (SHA-256)', () => {
      const result = hash('test');
      expect(result).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(result)).toBe(true);
    });
  });
});
