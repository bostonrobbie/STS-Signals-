/**
 * Webhook Quantity Multiplier Tests
 * 
 * Tests for the quantity multiplier feature that allows users to
 * scale up their signal quantities.
 */

import { describe, it, expect } from 'vitest';
import { validatePayload } from './webhookService';

describe('Webhook Quantity Multiplier', () => {
  describe('Basic Quantity Handling', () => {
    it('should use quantity from payload when no multiplier', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 2,
        price: 5000,
        direction: 'Long',
        token: 'test_token'
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(2);
    });

    it('should default quantity to 1 when not provided', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        price: 5000,
        direction: 'Long',
        token: 'test_token'
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(1);
    });
  });

  describe('Quantity Multiplier', () => {
    it('should apply 2x multiplier correctly', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 1,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: 2
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(2);
    });

    it('should apply 3x multiplier to quantity of 2', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 2,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: 3
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(6);
    });

    it('should round fractional results', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 3,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: 1.5
      };
      
      const result = validatePayload(payload);
      // 3 * 1.5 = 4.5, rounded to 5
      expect(result.quantity).toBe(5);
    });

    it('should ignore multiplier of 1', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 5,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: 1
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(5);
    });

    it('should ignore invalid multiplier (0)', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 5,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: 0
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(5);
    });

    it('should ignore negative multiplier', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 5,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: -2
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(5);
    });

    it('should handle large multipliers', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 1,
        price: 5000,
        direction: 'Long',
        token: 'test_token',
        quantityMultiplier: 10
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(10);
    });
  });

  describe('Fixed Quantity (no TradingView placeholder)', () => {
    it('should use fixed quantity when provided as number', () => {
      const payload = {
        symbol: 'ESTrend',
        date: '2024-01-15T10:30:00Z',
        data: 'buy',
        quantity: 5, // Fixed quantity, not from TradingView
        price: 5000,
        direction: 'Long',
        token: 'test_token'
      };
      
      const result = validatePayload(payload);
      expect(result.quantity).toBe(5);
    });
  });
});
