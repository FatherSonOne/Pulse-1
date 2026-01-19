import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNotificationStore } from '../notificationStore';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../types/notifications';
import { notificationService } from '../../services/notificationService';
import { settingsService } from '../../services/settingsService';

vi.mock('../../services/notificationService', () => ({
  notificationService: {
    notifyNewEmail: vi.fn(),
    notify: vi.fn(),
    createBatch: vi.fn().mockImplementation((notifications) => ({
      id: 'batch-1',
      category: 'email',
      count: notifications.length,
      notifications,
      summary: `${notifications.length} new emails`,
      timestamp: new Date(),
    })),
  },
}));

vi.mock('../../services/settingsService', () => ({
  settingsService: {
    get: vi.fn(),
  },
}));

describe('NotificationStore email bundling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('uuid-1'),
    });
    useNotificationStore.setState({
      notifications: [],
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, batchInterval: 1 },
      permissionStatus: 'default' as NotificationPermission,
      isSupported: false,
      isInitialized: false,
      showNotificationCenter: false,
      batchedNotifications: new Map(),
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('batches non-important email notifications when enabled', async () => {
    vi.mocked(settingsService.get).mockResolvedValue(true);

    await useNotificationStore.getState().notifyEmail({
      senderName: 'Alice',
      senderEmail: 'alice@example.com',
      subject: 'Hello',
      preview: 'Preview',
    });

    expect(notificationService.notifyNewEmail).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().batchedNotifications.get('email')?.length).toBe(1);

    await vi.runAllTimersAsync();
    expect(notificationService.notify).toHaveBeenCalledTimes(1);
  });

  it('sends email notifications immediately when bundling disabled', async () => {
    vi.mocked(settingsService.get).mockResolvedValue(false);

    await useNotificationStore.getState().notifyEmail({
      senderName: 'Bob',
      senderEmail: 'bob@example.com',
      subject: 'Update',
      preview: 'Preview',
    });

    expect(notificationService.notifyNewEmail).toHaveBeenCalledTimes(1);
    expect(notificationService.notify).not.toHaveBeenCalled();
  });
});
