"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, Notification } from "./types";

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
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
  notifications: [],
  unreadCount: 0,
  refreshNotifications: () => {},
  markNotificationRead: () => {},
  markAllRead: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);

  const refreshNotifications = useCallback(() => {
    if (currentUser) {
      fetch(`/api/notifications?user_id=${currentUser.id}`)
        .then((r) => r.json())
        .then(setNotifications);
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
    }).then(refreshNotifications);
  };

  const markAllRead = () => {
    if (currentUser) {
      fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true, user_id: currentUser.id }),
      }).then(refreshNotifications);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
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
