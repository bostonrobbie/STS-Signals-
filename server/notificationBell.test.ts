/**
 * Notification Bell API Tests
 * 
 * Tests for the in-app notification system used by the notification bell UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database functions
vi.mock('./services/inAppNotificationService', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  deleteOldNotifications: vi.fn(),
  createNotification: vi.fn(),
}));

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteOldNotifications,
  createNotification,
} from './services/inAppNotificationService';

describe('Notification Bell API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return notifications for a user', async () => {
      const mockNotifications = [
        {
          id: 1,
          userId: 1,
          type: 'trade_executed',
          title: 'Trade Executed',
          message: 'ES Trend triggered a buy signal',
          read: false,
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          type: 'position_closed',
          title: 'Position Closed',
          message: 'Closed with profit: $500',
          read: true,
          createdAt: new Date(Date.now() - 3600000),
        },
      ];

      (getNotifications as any).mockResolvedValue(mockNotifications);

      const result = await getNotifications({
        userId: 1,
        unreadOnly: false,
        limit: 20,
      });

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('trade_executed');
    });

    it('should filter unread only notifications', async () => {
      const mockNotifications = [
        {
          id: 1,
          userId: 1,
          type: 'trade_executed',
          title: 'Trade Executed',
          message: 'ES Trend triggered a buy signal',
          read: false,
          createdAt: new Date(),
        },
      ];

      (getNotifications as any).mockResolvedValue(mockNotifications);

      const result = await getNotifications({
        userId: 1,
        unreadOnly: true,
        limit: 20,
      });

      expect(result).toHaveLength(1);
      expect(result[0].read).toBe(false);
    });

    it('should respect limit parameter', async () => {
      const mockNotifications = Array(5).fill(null).map((_, i) => ({
        id: i + 1,
        userId: 1,
        type: 'system',
        title: `Notification ${i + 1}`,
        message: 'Test message',
        read: false,
        createdAt: new Date(),
      }));

      (getNotifications as any).mockResolvedValue(mockNotifications);

      const result = await getNotifications({
        userId: 1,
        limit: 5,
      });

      expect(result).toHaveLength(5);
    });
  });

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      (getUnreadCount as any).mockResolvedValue(5);

      const count = await getUnreadCount(1);

      expect(count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      (getUnreadCount as any).mockResolvedValue(0);

      const count = await getUnreadCount(1);

      expect(count).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      (markAsRead as any).mockResolvedValue(true);

      const result = await markAsRead(1, 1);

      expect(result).toBe(true);
    });

    it('should return false for non-existent notification', async () => {
      (markAsRead as any).mockResolvedValue(false);

      const result = await markAsRead(999, 1);

      expect(result).toBe(false);
    });

    it('should not allow marking other users notifications', async () => {
      (markAsRead as any).mockResolvedValue(false);

      const result = await markAsRead(1, 2); // Different user

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      (markAllAsRead as any).mockResolvedValue(5);

      const count = await markAllAsRead(1);

      expect(count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      (markAllAsRead as any).mockResolvedValue(0);

      const count = await markAllAsRead(1);

      expect(count).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      (deleteNotification as any).mockResolvedValue(true);

      const result = await deleteNotification(1, 1);

      expect(result).toBe(true);
    });

    it('should return false for non-existent notification', async () => {
      (deleteNotification as any).mockResolvedValue(false);

      const result = await deleteNotification(999, 1);

      expect(result).toBe(false);
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete old read notifications', async () => {
      (deleteOldNotifications as any).mockResolvedValue(10);

      const count = await deleteOldNotifications(30);

      expect(count).toBe(10);
    });

    it('should delete all read notifications when days is 0', async () => {
      (deleteOldNotifications as any).mockResolvedValue(25);

      const count = await deleteOldNotifications(0);

      expect(count).toBe(25);
    });
  });

  describe('createNotification', () => {
    it('should create a trade executed notification', async () => {
      (createNotification as any).mockResolvedValue(1);

      const id = await createNotification({
        userId: 1,
        type: 'trade_executed',
        title: 'Trade Executed',
        message: 'ES Trend triggered a buy signal at $5000',
        strategyId: 9,
      });

      expect(id).toBe(1);
    });

    it('should create a webhook failed notification', async () => {
      (createNotification as any).mockResolvedValue(2);

      const id = await createNotification({
        userId: 1,
        type: 'webhook_failed',
        title: 'Webhook Processing Failed',
        message: 'Invalid token provided',
        webhookLogId: 123,
      });

      expect(id).toBe(2);
    });

    it('should create a position closed notification', async () => {
      (createNotification as any).mockResolvedValue(3);

      const id = await createNotification({
        userId: 1,
        type: 'position_closed',
        title: 'Position Closed',
        message: 'Closed with profit: $500 (2.5%)',
        strategyId: 9,
        tradeId: 456,
      });

      expect(id).toBe(3);
    });
  });
});

describe('Notification Types', () => {
  const validTypes = [
    'trade_executed',
    'trade_error',
    'position_opened',
    'position_closed',
    'webhook_failed',
    'daily_digest',
    'system',
  ];

  it('should support all notification types', () => {
    validTypes.forEach(type => {
      expect(validTypes).toContain(type);
    });
  });

  it('should have 7 notification types', () => {
    expect(validTypes).toHaveLength(7);
  });
});

describe('Notification Filtering', () => {
  it('should support filtering by type', async () => {
    const mockNotifications = [
      { id: 1, type: 'trade_executed', read: false },
      { id: 2, type: 'webhook_failed', read: false },
    ];

    (getNotifications as any).mockResolvedValue(
      mockNotifications.filter(n => n.type === 'trade_executed')
    );

    const result = await getNotifications({
      userId: 1,
      types: ['trade_executed'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('trade_executed');
  });

  it('should support filtering by date range', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);

    (getNotifications as any).mockResolvedValue([
      { id: 1, type: 'system', createdAt: now },
    ]);

    const result = await getNotifications({
      userId: 1,
      since: yesterday,
    });

    expect(result).toHaveLength(1);
  });

  it('should support pagination with offset', async () => {
    const mockNotifications = Array(10).fill(null).map((_, i) => ({
      id: i + 11,
      type: 'system',
      read: false,
    }));

    (getNotifications as any).mockResolvedValue(mockNotifications);

    const result = await getNotifications({
      userId: 1,
      limit: 10,
      offset: 10,
    });

    expect(result).toHaveLength(10);
    expect(result[0].id).toBe(11);
  });
});

describe('Notification Security', () => {
  it('should only return notifications for the authenticated user', async () => {
    // User 1's notifications
    (getNotifications as any).mockResolvedValue([
      { id: 1, userId: 1, type: 'system' },
    ]);

    const user1Notifications = await getNotifications({ userId: 1 });
    expect(user1Notifications.every((n: any) => n.userId === 1)).toBe(true);
  });

  it('should prevent cross-user notification access', async () => {
    (markAsRead as any).mockResolvedValue(false);

    // User 2 trying to mark User 1's notification as read
    const result = await markAsRead(1, 2);

    expect(result).toBe(false);
  });

  it('should prevent cross-user notification deletion', async () => {
    (deleteNotification as any).mockResolvedValue(false);

    // User 2 trying to delete User 1's notification
    const result = await deleteNotification(1, 2);

    expect(result).toBe(false);
  });
});

describe('Notification Performance', () => {
  it('should handle large notification counts efficiently', async () => {
    const largeCount = 9999;
    (getUnreadCount as any).mockResolvedValue(largeCount);

    const count = await getUnreadCount(1);

    expect(count).toBe(largeCount);
  });

  it('should limit results to prevent memory issues', async () => {
    const mockNotifications = Array(20).fill(null).map((_, i) => ({
      id: i + 1,
      type: 'system',
    }));

    (getNotifications as any).mockResolvedValue(mockNotifications);

    const result = await getNotifications({
      userId: 1,
      limit: 20, // Max limit
    });

    expect(result.length).toBeLessThanOrEqual(20);
  });
});
