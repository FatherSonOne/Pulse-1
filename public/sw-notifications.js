/**
 * Pulse Notification Service Worker
 * Handles push notifications, background sync, and notification actions
 */

// Service Worker version for cache busting
const SW_VERSION = '1.0.0';
const CACHE_NAME = `pulse-notifications-${SW_VERSION}`;

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Pulse Notification Service Worker v' + SW_VERSION);
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Pulse Notification Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('pulse-notifications-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'Pulse',
    body: 'You have a new notification',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: 'pulse-notification',
    data: {},
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.svg',
    badge: data.badge || '/icons/icon-192.svg',
    tag: data.tag || 'pulse-notification',
    renotify: true,
    requireInteraction: data.priority === 'urgent',
    silent: false,
    vibrate: data.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: {
      ...data.data,
      timestamp: Date.now(),
      url: data.actionUrl || '/',
    },
    actions: data.actions || [],
  };

  // Add image if present
  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interactions
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;
  const url = notificationData.url || '/';

  // Handle action button clicks
  if (action) {
    switch (action) {
      case 'reply':
        // Open app to reply
        event.waitUntil(openOrFocusApp(url + '?action=reply'));
        break;
      case 'archive':
        // Send archive request to the app
        event.waitUntil(
          sendMessageToApp({
            type: 'NOTIFICATION_ACTION',
            action: 'archive',
            notificationId: notificationData.id,
          })
        );
        break;
      case 'snooze':
        // Snooze the notification for 15 minutes
        event.waitUntil(
          scheduleSnoozeNotification(event.notification, 15)
        );
        break;
      case 'mark_read':
        event.waitUntil(
          sendMessageToApp({
            type: 'NOTIFICATION_ACTION',
            action: 'mark_read',
            notificationId: notificationData.id,
          })
        );
        break;
      default:
        event.waitUntil(openOrFocusApp(url));
    }
  } else {
    // Default click - open the app
    event.waitUntil(openOrFocusApp(url));
  }

  // Track notification click event
  event.waitUntil(
    trackNotificationEvent({
      notificationId: notificationData.id || event.notification.tag,
      event: action ? 'action_clicked' : 'clicked',
      actionId: action,
      timestamp: new Date().toISOString(),
    })
  );
});

// Notification close event - track dismissals
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);

  const notificationData = event.notification.data || {};

  event.waitUntil(
    trackNotificationEvent({
      notificationId: notificationData.id || event.notification.tag,
      event: 'dismissed',
      timestamp: new Date().toISOString(),
    })
  );
});

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('Pulse Test', {
      body: 'This is a test notification from Pulse!',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: 'pulse-test',
      renotify: true,
      vibrate: [200, 100, 200],
    });
  }

  if (event.data.type === 'CLEAR_NOTIFICATIONS') {
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((notification) => notification.close());
    });
  }
});

// Helper: Open or focus the app window
async function openOrFocusApp(url) {
  const urlToOpen = new URL(url, self.location.origin).href;

  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  // Check if there's already a window open
  for (const client of windowClients) {
    if (client.url === urlToOpen && 'focus' in client) {
      return client.focus();
    }
  }

  // Open a new window
  if (clients.openWindow) {
    return clients.openWindow(urlToOpen);
  }
}

// Helper: Send message to the main app
async function sendMessageToApp(message) {
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    client.postMessage(message);
  }
}

// Helper: Schedule a snoozed notification
async function scheduleSnoozeNotification(originalNotification, minutes) {
  // Store the notification data for later
  const notificationData = {
    title: originalNotification.title,
    body: originalNotification.body,
    icon: originalNotification.icon,
    tag: originalNotification.tag + '-snoozed',
    data: {
      ...originalNotification.data,
      snoozed: true,
      originalTime: new Date().toISOString(),
    },
  };

  // Use the Notification API to schedule (in a real app, this would use a background sync or server-side scheduling)
  setTimeout(() => {
    self.registration.showNotification(
      'Reminder: ' + notificationData.title,
      {
        body: notificationData.body,
        icon: notificationData.icon,
        tag: notificationData.tag,
        renotify: true,
        data: notificationData.data,
      }
    );
  }, minutes * 60 * 1000);

  // Notify the user that the notification was snoozed
  await self.registration.showNotification('Snoozed', {
    body: `Reminder set for ${minutes} minutes`,
    icon: '/icons/icon-192.svg',
    tag: 'pulse-snooze-confirm',
    silent: true,
  });

  // Close the confirmation after a moment
  setTimeout(async () => {
    const notifications = await self.registration.getNotifications({
      tag: 'pulse-snooze-confirm',
    });
    notifications.forEach((n) => n.close());
  }, 3000);
}

// Helper: Track notification events (for analytics)
async function trackNotificationEvent(eventData) {
  // In a production app, this would send analytics to your server
  console.log('[SW] Notification event:', eventData);

  // Store locally for the app to retrieve
  try {
    const cache = await caches.open(CACHE_NAME);
    const events = await getStoredEvents(cache);
    events.push(eventData);

    // Keep only last 100 events
    const trimmedEvents = events.slice(-100);
    await cache.put(
      'notification-events',
      new Response(JSON.stringify(trimmedEvents))
    );
  } catch (error) {
    console.error('[SW] Error storing notification event:', error);
  }
}

// Helper: Get stored notification events
async function getStoredEvents(cache) {
  try {
    const response = await cache.match('notification-events');
    if (response) {
      return response.json();
    }
  } catch (error) {
    console.error('[SW] Error reading stored events:', error);
  }
  return [];
}

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncPendingNotifications());
  }
});

// Sync pending notifications when back online
async function syncPendingNotifications() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('pending-notifications');

    if (response) {
      const pendingNotifications = await response.json();

      for (const notification of pendingNotifications) {
        await self.registration.showNotification(notification.title, notification.options);
      }

      // Clear pending notifications
      await cache.delete('pending-notifications');
    }
  } catch (error) {
    console.error('[SW] Error syncing pending notifications:', error);
  }
}

console.log('[SW] Pulse Notification Service Worker loaded v' + SW_VERSION);
