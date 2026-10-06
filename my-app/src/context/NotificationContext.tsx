import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from './AuthContext';

export interface NotificationItem {
  id: number;
  type: 'NEW_ORDER' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RETURN_REQUEST' | string;
  title: string;
  message: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  soundEnabled: boolean;
  browserPermission: NotificationPermission;
  filter: 'all' | 'unread';
  setFilter: (filter: 'all' | 'unread') => void;
  fetchNotifications: (page?: number, filterType?: 'all' | 'unread') => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleSound: () => void;
  requestBrowserPermission: () => Promise<void>;
  clearAllLocal: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('shophub_admin_sound') !== 'false';
  });
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });

  // Synthesize chime sound via Web Audio API (Resilient against missing MP3 assets)
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playNote(587.33, now, 0.15); // D5
      playNote(880.00, now + 0.1, 0.35); // A5
    } catch (err) {
      console.warn('Audio playback blocked or unsupported:', err);
    }
  }, [soundEnabled]);

  // Request browser notification permission
  const requestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
    } catch (e) {
      console.warn('Browser permission request error:', e);
    }
  };

  // Toggle sound setting
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('shophub_admin_sound', String(next));
      return next;
    });
  };

  // Fetch paginated notifications from REST API
  const fetchNotifications = useCallback(
    async (page = 1, filterType = filter) => {
      if (!user?.token || user.role !== 'admin') return;
      try {
        const res = await fetch(`/api/admin/notifications?page=${page}&limit=20&filter=${filterType}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        console.error('Failed to fetch admin notifications:', err);
      }
    },
    [user?.token, user?.role, filter]
  );

  // Mark single as read
  const markAsRead = async (id: number) => {
    if (!user?.token) return;
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.token) return;
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);

      await fetch(`/api/admin/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Clear all local/mark all as read
  const clearAllLocal = async () => {
    await markAllAsRead();
  };

  // Initial fetch
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchNotifications(1, filter);
    }
  }, [user?.role, filter, fetchNotifications]);

  // Connect Socket.io
  useEffect(() => {
    if (!user?.token || user.role !== 'admin') return;

    const socketUrl = window.location.origin;
    const socket: Socket = io(socketUrl, {
      auth: { token: user.token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Admin Notification Socket.io');
    });

    socket.on('new_notification', (newNotif: NotificationItem) => {
      console.log('🔔 Real-time Admin Notification Received:', newNotif);

      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // 1. Audio chime
      playChime();

      // 2. Toast notification
      let icon = '🔔';
      if (newNotif.type === 'NEW_ORDER') icon = '🛍️';
      else if (newNotif.type === 'PAYMENT_SUCCESS') icon = '💳';
      else if (newNotif.type === 'PAYMENT_FAILED') icon = '❌';
      else if (newNotif.type === 'LOW_STOCK') icon = '⚠️';
      else if (newNotif.type === 'OUT_OF_STOCK') icon = '📦';
      else if (newNotif.type === 'RETURN_REQUEST') icon = '🔄';

      toast(
        (t) => (
          <div className="flex flex-col gap-1" onClick={() => toast.dismiss(t.id)}>
            <span className="font-bold text-slate-900 text-sm">{newNotif.title}</span>
            <span className="text-xs text-slate-600">{newNotif.message}</span>
          </div>
        ),
        {
          icon,
          duration: 5000,
          position: 'top-right',
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
          },
        }
      );

      // 3. Desktop/Browser Notification
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(newNotif.title, {
            body: newNotif.message,
            icon: '/favicon.ico',
          });
        } catch (err) {
          console.warn('Desktop notification error:', err);
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚡ Admin Socket.io disconnected:', reason);
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.token, user?.role, playChime]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        soundEnabled,
        browserPermission,
        filter,
        setFilter,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        toggleSound,
        requestBrowserPermission,
        clearAllLocal,
      }}
    >
      <Toaster />
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
