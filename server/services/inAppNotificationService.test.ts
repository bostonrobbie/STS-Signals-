/**
 * In-App Notification Service Tests
 * 
 * Comprehensive tests for the notification system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

// Mock the schema
vi.mock('../../drizzle/schema', () => ({
  notifications: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    title: 'title',
    message: 'message',
    read: 'read',
    dismissed: 'dismissed',
    emailSent: 'emailSent',
    createdAt: 'createdAt',
    strategyId: 'strategyId',
    tradeId: 'tradeId',
    webhookLogId: 'webhookLogId',
  },
  users: {
    id: 'id',
    role: 'role',
  },
}));

import { getDb } from '../db';
import {
  createNotification,
  notifyAdmins,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteOldNotifications,
  notifyTradeExecuted,
  notifyPositionOpened,
  notifyPositionClosed,
  notifySystemAlert,
  notifyWebhookFailure,
  notifyDailyDigest,
  notifyTradeError,
  NotificationType,
} from './inAppNotificationService';

describe('In-App Notification Service', () => {
  let mockDb: any;
  let mockInsert: any;
  let mockSelect: any;
  let mockUpdate: any;
  let mockDelete: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock chain methods
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    });
    
    mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });
    
    mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
    });
    
    mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
    });
    
    mockDb = {
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    };
    
    (getDb as any).mockResolvedValue(mockDb);
  });

  describe('createNotification', () => {
    it('should create a notification with all required fields', async () => {
      const params = {
        userId: 1,
        type: 'trade_executed' as NotificationType,
        title: 'Test Notification',
        message: 'This is a test message',
      };

      const result = await createNotification(params);
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create a notification with optional fields', async () => {
      const params = {
        userId: 1,
        type: 'position_closed' as NotificationType,
        title: 'Position Closed',
        message: 'Closed with profit',
        strategyId: 5,
        tradeId: 100,
        webhookLogId: 200,
      };

      const result = await createNotification(params);
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should throw error when database is not available', async () => {
      (getDb as any).mockResolvedValue(null);

      await expect(createNotification({
        userId: 1,
        type: 'system',
        title: 'Test',
        message: 'Test',
      })).rejects.toThrow('Database not available');
    });
  });

  describe('notifyAdmins', () => {
    it('should create notifications for all admin users', async () => {
      // Mock admin users query
      const mockAdminSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 1 },
            { id: 2 },
          ]),
        }),
      });
      
      mockDb.select = mockAdminSelect;
      
      const params = {
        type: 'system' as NotificationType,
        title: 'System Alert',
        message: 'Critical system event',
      };

      const result = await notifyAdmins(params);
      
      expect(result).toHaveLength(2);
    });
  });

  describe('getNotifications', () => {
    it('should get notifications for a user', async () => {
      const mockNotifications = [
        { id: 1, userId: 1, type: 'trade_executed', title: 'Trade 1', read: false },
        { id: 2, userId: 1, type: 'system', title: 'System Alert', read: true },
      ];
      
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockNotifications),
              }),
            }),
          }),
        }),
      };
      
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      const result = await getNotifications({ userId: 1 });
      
      expect(result).toEqual(mockNotifications);
    });

    it('should filter by notification types', async () => {
      const mockNotifications = [
        { id: 1, userId: 1, type: 'trade_executed', title: 'Trade 1', read: false },
        { id: 2, userId: 1, type: 'system', title: 'System Alert', read: true },
      ];
      
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockNotifications),
              }),
            }),
          }),
        }),
      };
      
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      const result = await getNotifications({ 
        userId: 1, 
        types: ['trade_executed'] 
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('trade_executed');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      };
      
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      const result = await getUnreadCount(1);
      
      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      };
      
      mockDb.select = vi.fn().mockReturnValue(mockSelectChain);

      const result = await getUnreadCount(1);
      
      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const result = await markAsRead(1, 1);
      
      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when notification not found', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ affectedRows: 0 }]),
        }),
      });

      const result = await markAsRead(999, 1);
      
      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ affectedRows: 10 }]),
        }),
      });

      const result = await markAllAsRead(1);
      
      expect(result).toBe(10);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const result = await deleteNotification(1, 1);
      
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete old read notifications', async () => {
      mockDb.delete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 50 }]),
      });

      const result = await deleteOldNotifications(30);
      
      expect(result).toBe(50);
    });
  });

  describe('Convenience notification functions', () => {
    it('should create trade executed notification', async () => {
      const result = await notifyTradeExecuted(
        1,
        'ES Trend Following',
        'BUY',
        'ES',
        4500.50,
        1,
        100
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create position opened notification', async () => {
      const result = await notifyPositionOpened(
        1,
        'NQ Breakout',
        'LONG',
        15000.00,
        2,
        2
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create position closed notification with profit', async () => {
      const result = await notifyPositionClosed(
        1,
        'CL Trend',
        500.00,
        2.5,
        3,
        200
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create position closed notification with loss', async () => {
      const result = await notifyPositionClosed(
        1,
        'CL Trend',
        -200.00,
        -1.0,
        3,
        201
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create system alert notification', async () => {
      const result = await notifySystemAlert(
        1,
        'Database Connection',
        'Connection pool exhausted'
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create webhook failure notification', async () => {
      const result = await notifyWebhookFailure(
        1,
        500,
        'Invalid payload format'
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create daily digest notification', async () => {
      const result = await notifyDailyDigest(
        1,
        'Today: 5 trades, +$1,250 P&L, 80% win rate'
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should create trade error notification', async () => {
      const result = await notifyTradeError(
        1,
        'Failed to execute order: Insufficient margin',
        1
      );
      
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('Notification types validation', () => {
    const validTypes: NotificationType[] = [
      'trade_executed',
      'trade_error',
      'position_opened',
      'position_closed',
      'webhook_failed',
      'daily_digest',
      'system',
    ];

    validTypes.forEach((type) => {
      it(`should accept valid notification type: ${type}`, async () => {
        const result = await createNotification({
          userId: 1,
          type,
          title: `Test ${type}`,
          message: 'Test message',
        });
        
        expect(result).toBe(1);
      });
    });
  });
});
