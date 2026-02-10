"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, Notification } from "./types";

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  usersLoading: boolean;
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => void;
  markNotificationRead: (id: number) => void;
  markAllRead: () => void;
}

const AppContext = createContext<AppContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  users: [],
  usersLoading: true,
  notifications: [],
  unreadCount: 0,
  refreshNotifications: () => {},
  markNotificationRead: () => {},
  markAllRead: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let retries = 0;
    const fetchUsers = () => {
      fetch("/api/users")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setUsers(data);
          }
          setUsersLoading(false);
        })
        .catch(() => {
          retries++;
          if (retries < 5) {
            setTimeout(fetchUsers, retries * 1000);
          } else {
            setUsersLoading(false);
          }
        });
    };
    fetchUsers();
  }, []);

  const refreshNotifications = useCallback(() => {
    if (currentUser) {
      fetch(`/api/notifications?user_id=${currentUser.id}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(setNotifications)
        .catch(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markNotificationRead = (id: number) => {
    fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then(refreshNotifications).catch(() => {});
  };

  const markAllRead = () => {
    if (currentUser) {
      fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true, user_id: currentUser.id }),
      }).then(refreshNotifications).catch(() => {});
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        usersLoading,
        notifications,
        unreadCount,
        refreshNotifications,
        markNotificationRead,
        markAllRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
