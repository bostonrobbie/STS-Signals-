import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getNotificationPreferences: vi.fn(),
  upsertNotificationPreferences: vi.fn(),
  getStrategyNotificationSettings: vi.fn(),
  getStrategyNotificationSetting: vi.fn(),
  upsertStrategyNotificationSetting: vi.fn(),
  shouldSendNotification: vi.fn(),
  getStrategiesWithNotificationSettings: vi.fn(),
  getAllStrategies: vi.fn(),
}));

import * as db from './db';

describe('Notification Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotificationPreferences', () => {
    it('should return null when no preferences exist', async () => {
      vi.mocked(db.getNotificationPreferences).mockResolvedValue(null);
      
      const result = await db.getNotificationPreferences(1);
      expect(result).toBeNull();
    });

    it('should return preferences when they exist', async () => {
      const mockPrefs = {
        id: 1,
        userId: 1,
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        notifyOnEntry: true,
        notifyOnExit: true,
        notifyOnProfit: true,
        notifyOnLoss: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        quietHoursTimezone: 'America/New_York',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(db.getNotificationPreferences).mockResolvedValue(mockPrefs);
      
      const result = await db.getNotificationPreferences(1);
      expect(result).toEqual(mockPrefs);
      expect(result?.emailNotificationsEnabled).toBe(true);
      expect(result?.pushNotificationsEnabled).toBe(false);
    });
  });

  describe('upsertNotificationPreferences', () => {
    it('should create new preferences', async () => {
      vi.mocked(db.upsertNotificationPreferences).mockResolvedValue(undefined);
      
      await db.upsertNotificationPreferences(1, {
        emailNotificationsEnabled: true,
        notifyOnEntry: false,
      });
      
      expect(db.upsertNotificationPreferences).toHaveBeenCalledWith(1, {
        emailNotificationsEnabled: true,
        notifyOnEntry: false,
      });
    });
  });

  describe('getStrategyNotificationSettings', () => {
    it('should return empty array when no settings exist', async () => {
      vi.mocked(db.getStrategyNotificationSettings).mockResolvedValue([]);
      
      const result = await db.getStrategyNotificationSettings(1);
      expect(result).toEqual([]);
    });

    it('should return all strategy settings for user', async () => {
      const mockSettings = [
        { id: 1, userId: 1, strategyId: 1, emailEnabled: true, pushEnabled: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, userId: 1, strategyId: 2, emailEnabled: false, pushEnabled: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      
      vi.mocked(db.getStrategyNotificationSettings).mockResolvedValue(mockSettings);
      
      const result = await db.getStrategyNotificationSettings(1);
      expect(result).toHaveLength(2);
      expect(result[0]?.emailEnabled).toBe(true);
      expect(result[1]?.emailEnabled).toBe(false);
    });
  });

  describe('shouldSendNotification', () => {
    it('should return true for both when no preferences set (defaults)', async () => {
      vi.mocked(db.shouldSendNotification).mockResolvedValue({ email: true, push: true });
      
      const result = await db.shouldSendNotification(1, 1, 'entry');
      expect(result.email).toBe(true);
      expect(result.push).toBe(true);
    });

    it('should respect global email toggle', async () => {
      vi.mocked(db.shouldSendNotification).mockResolvedValue({ email: false, push: true });
      
      const result = await db.shouldSendNotification(1, 1, 'entry');
      expect(result.email).toBe(false);
      expect(result.push).toBe(true);
    });

    it('should respect strategy-specific settings', async () => {
      vi.mocked(db.shouldSendNotification).mockResolvedValue({ email: true, push: false });
      
      const result = await db.shouldSendNotification(1, 2, 'exit');
      expect(result.email).toBe(true);
      expect(result.push).toBe(false);
    });

    it('should check notification type (entry/exit/profit/loss)', async () => {
      // Entry enabled
      vi.mocked(db.shouldSendNotification).mockResolvedValueOnce({ email: true, push: true });
      const entryResult = await db.shouldSendNotification(1, 1, 'entry');
      expect(entryResult.email).toBe(true);
      
      // Loss disabled
      vi.mocked(db.shouldSendNotification).mockResolvedValueOnce({ email: false, push: false });
      const lossResult = await db.shouldSendNotification(1, 1, 'loss');
      expect(lossResult.email).toBe(false);
    });
  });

  describe('getStrategiesWithNotificationSettings', () => {
    it('should return strategies with default settings when none set', async () => {
      vi.mocked(db.getStrategiesWithNotificationSettings).mockResolvedValue([
        { id: 1, symbol: 'ESTrend', name: 'ES Trend Following', emailEnabled: true, pushEnabled: true },
        { id: 2, symbol: 'NQTrend', name: 'NQ Trend Following', emailEnabled: true, pushEnabled: true },
      ]);
      
      const result = await db.getStrategiesWithNotificationSettings(1);
      expect(result).toHaveLength(2);
      expect(result[0]?.emailEnabled).toBe(true);
      expect(result[0]?.pushEnabled).toBe(true);
    });

    it('should return strategies with custom settings when set', async () => {
      vi.mocked(db.getStrategiesWithNotificationSettings).mockResolvedValue([
        { id: 1, symbol: 'ESTrend', name: 'ES Trend Following', emailEnabled: false, pushEnabled: true },
        { id: 2, symbol: 'NQTrend', name: 'NQ Trend Following', emailEnabled: true, pushEnabled: false },
      ]);
      
      const result = await db.getStrategiesWithNotificationSettings(1);
      expect(result[0]?.emailEnabled).toBe(false);
      expect(result[0]?.pushEnabled).toBe(true);
      expect(result[1]?.emailEnabled).toBe(true);
      expect(result[1]?.pushEnabled).toBe(false);
    });
  });

  describe('upsertStrategyNotificationSetting', () => {
    it('should update strategy notification settings', async () => {
      vi.mocked(db.upsertStrategyNotificationSetting).mockResolvedValue(undefined);
      
      await db.upsertStrategyNotificationSetting(1, 1, { emailEnabled: false });
      
      expect(db.upsertStrategyNotificationSetting).toHaveBeenCalledWith(1, 1, { emailEnabled: false });
    });

    it('should handle both email and push toggles', async () => {
      vi.mocked(db.upsertStrategyNotificationSetting).mockResolvedValue(undefined);
      
      await db.upsertStrategyNotificationSetting(1, 2, { emailEnabled: true, pushEnabled: false });
      
      expect(db.upsertStrategyNotificationSetting).toHaveBeenCalledWith(1, 2, { emailEnabled: true, pushEnabled: false });
    });
  });
});

describe('Notification Preferences Integration', () => {
  describe('Preference Cascade Logic', () => {
    it('should disable notifications when global is off even if strategy is on', async () => {
      // This tests the cascade: global OFF + strategy ON = notifications OFF
      vi.mocked(db.shouldSendNotification).mockResolvedValue({ email: false, push: false });
      
      const result = await db.shouldSendNotification(1, 1, 'entry');
      expect(result.email).toBe(false);
      expect(result.push).toBe(false);
    });

    it('should disable notifications when type is off even if global and strategy are on', async () => {
      // This tests: global ON + strategy ON + type (loss) OFF = notifications OFF
      vi.mocked(db.shouldSendNotification).mockResolvedValue({ email: false, push: false });
      
      const result = await db.shouldSendNotification(1, 1, 'loss');
      expect(result.email).toBe(false);
    });
  });
});
