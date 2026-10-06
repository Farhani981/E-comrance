import { requestProfile } from '../utils/profile.js';
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 1. User state initialized from localStorage
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('shophub_user');
      const parsedUser = savedUser ? JSON.parse(savedUser) : null;
      return parsedUser?.token?.startsWith('demo-token-') ? null : parsedUser;
    } catch {
      return null;
    }
  });

  const [profileState, setProfileState] = useState({ token: null, version: -1, error: '' });
  const [profileReload, setProfileReload] = useState(0);
  const token = user?.token;
  const profileCurrent = profileState.token === token && profileState.version === profileReload;
  const profileLoading = !!token && !profileCurrent;
  const profileError = profileCurrent ? profileState.error : '';
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    requestProfile(token, { signal: controller.signal }).then(profile => {
      if (!controller.signal.aborted) {
        setUser(previous => previous?.token === token ? { ...profile, token, createdAt: profile.created_at } : previous);
        setProfileState({ token, version: profileReload, error: '' });
      }
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error.status === 401) setUser(previous => previous?.token === token ? null : previous);
      setProfileState({ token, version: profileReload, error: error.message || 'Unable to load your profile. Please try again.' });
    });
    return () => controller.abort();
  }, [token, profileReload]);

  // 2. Orders list state
  const [orders, setOrders] = useState([]);

  // Fetch orders for authenticated user
  useEffect(() => {
    if (!token) {
      setOrders([]);
      return;
    }
    const controller = new AbortController();
    fetch('/api/orders/my-orders', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          console.error('Error fetching user orders:', err);
        }
      });
    return () => controller.abort();
  }, [token]);
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('shophub_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('shophub_user');
      }
    } catch (e) {
      console.error('Failed to save user state', e);
    }
  }, [user]);

  // Clear legacy global order storage
  useEffect(() => {
    try {
      localStorage.removeItem('shophub_orders');
    } catch {
      // ignore
    }
  }, []);

  // Login handler
  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json().catch(() => {
        throw new Error('Authentication service is unavailable. Restart the app with npm run dev and check the backend output.');
      });
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }
      
      const userData = {
        ...data.user,
        token: data.token,
        phone: data.user.phone || '',
        address: data.user.address || '',
        city: data.user.city || '',
        createdAt: data.user.created_at || new Date().toLocaleDateString()
      };
      setUser(userData);
      return userData;
    } catch (error) {
      if (error.name === 'TypeError') {
        throw new Error('Cannot connect to the authentication server. Please start the backend and try again.');
      }

      throw error;
    }
  };

  // Register handler
  const register = async (name, email, password) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json().catch(() => {
        throw new Error('Authentication service is unavailable. Restart the app with npm run dev and check the backend output.');
      });
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Registration failed');
      }
      
      const userData = {
        ...data.user,
        token: data.token,
        phone: '',
        address: '',
        city: '',
        createdAt: new Date().toLocaleDateString()
      };
      setUser(userData);
      return userData;
    } catch (error) {
      if (error.name === 'TypeError') {
        throw new Error('Cannot connect to the authentication server. Please start the backend and try again.');
      }

      throw error;
    }
  };

  // Logout handler
  const logout = useCallback(() => {
    setUser(null);
    setOrders([]);
    try {
      localStorage.removeItem('shophub_orders');
    } catch {
      // ignore
    }
  }, []);

  // Profile update handler
  const updateUser = async (updatedData) => {
    try {
      const profile = await requestProfile(token, { fields: updatedData });
      setUser(previous => previous?.token === token ? { ...profile, token, createdAt: profile.created_at } : previous);
      return profile;
    } catch (error) {
      if (error.status === 401) setUser(previous => previous?.token === token ? null : previous);
      throw error;
    }
  };

  // Add new order
  const addOrder = (newOrder) => {
    const orderWithStatus = {
      ...newOrder,
      status: 'Processing',
      createdAt: new Date().toISOString()
    };
    setOrders((prev) => [orderWithStatus, ...prev]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        orders,
        login,
        register,
        logout,
        updateUser, profileLoading, profileError, reloadProfile: () => setProfileReload(value => value + 1),
        addOrder
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
