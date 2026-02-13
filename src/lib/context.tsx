"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { Notification } from "./types";

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  trade_type: string | null;
  license_info: string | null;
  insurance_info: string | null;
  rating: number;
  rating_count: number;
}

interface AppContextType {
  currentUser: AppUser | null;
  loading: boolean;
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => void;
  markNotificationRead: (id: number) => void;
  markAllRead: () => void;
}

const AppContext = createContext<AppContextType>({
  currentUser: null,
  loading: true,
  notifications: [],
  unreadCount: 0,
  refreshNotifications: () => {},
  markNotificationRead: () => {},
  markAllRead: () => {},
});

function AppContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const currentUser: AppUser | null = session?.user
    ? {
        id: Number((session.user as Record<string, unknown>).id),
        name: session.user.name || "",
        email: session.user.email || "",
        role: (session.user as Record<string, unknown>).role as string,
        trade_type: (session.user as Record<string, unknown>).trade_type as string | null,
        license_info: ((session.user as Record<string, unknown>).license_info as string | null) || null,
        insurance_info: ((session.user as Record<string, unknown>).insurance_info as string | null) || null,
        rating: Number((session.user as Record<string, unknown>).rating) || 0,
        rating_count: Number((session.user as Record<string, unknown>).rating_count) || 0,
      }
    : null;

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
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        loading: status === "loading",
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppContextProvider>{children}</AppContextProvider>
    </SessionProvider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
