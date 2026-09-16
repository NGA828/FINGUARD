import { Injectable } from '@nestjs/common';
import { notifications, users } from '../database/connection';
import { nowIso, uuid } from '../common/utils';

@Injectable()
export class NotificationsService {
  /** Notifie un utilisateur précis. */
  notify(userId: string, type: string, title: string, message: string, transactionId?: string) {
    notifications.insert({
      id: uuid(),
      userId,
      type,
      title,
      message,
      transactionId: transactionId ?? null,
      isRead: false,
      createdAt: nowIso(),
    });
  }

  /** Notifie tous les employés actifs (alertes opérationnelles). */
  notifyEmployees(type: string, title: string, message: string, transactionId?: string) {
    const emps = users.all("role = 'EMPLOYEE' AND is_active = 1");
    for (const e of emps) this.notify(e.id, type, title, message, transactionId);
  }

  /** Notifie tous les administrateurs actifs. */
  notifyAdmins(type: string, title: string, message: string, transactionId?: string) {
    const admins = users.all("role = 'ADMIN' AND is_active = 1");
    for (const a of admins) this.notify(a.id, type, title, message, transactionId);
  }

  forUser(userId: string, unreadOnly = false) {
    return notifications.all(
      `user_id = ?${unreadOnly ? ' AND is_read = 0' : ''}`,
      [userId],
      'created_at DESC',
      100,
    );
  }

  unreadCount(userId: string): number {
    return notifications.count('user_id = ? AND is_read = 0', [userId]);
  }

  markRead(userId: string, notificationId: string) {
    const n = notifications.byId(notificationId);
    if (!n || n.userId !== userId) return null;
    return notifications.update(notificationId, { isRead: true });
  }

  markAllRead(userId: string) {
    const { run } = require('../database/connection');
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    return { success: true };
  }
}
