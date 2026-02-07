"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context";
import { Bell, Building2, ChevronDown, HardHat, Menu, X } from "lucide-react";

export function Navigation() {
  const { currentUser, setCurrentUser, users, notifications, unreadCount, markNotificationRead, markAllRead } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const homeowners = users.filter((u) => u.role === "homeowner");
  const trades = users.filter((u) => u.role === "trade");

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 hidden sm:block">
              Block<span className="text-primary-600">Construction</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          {currentUser && (
            <div className="hidden md:flex items-center gap-6">
              {currentUser.role === "homeowner" ? (
                <>
                  <Link href="/homeowner" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    Dashboard
                  </Link>
                  <Link href="/homeowner/projects/new" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    New Project
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/trade/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    Dashboard
                  </Link>
                  <Link href="/trade/blocks" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    Browse Blocks
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {currentUser && (
              <>
                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
                    className="relative p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
                      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                            Mark all read
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500 text-center">No notifications</p>
                      ) : (
                        notifications.slice(0, 15).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => { markNotificationRead(n.id); }}
                            className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.is_read ? "bg-primary-50" : ""}`}
                          >
                            <p className="text-sm font-medium text-gray-900">{n.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(n.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* User Switcher */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm"
              >
                {currentUser ? (
                  <>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${currentUser.role === "homeowner" ? "bg-primary-500" : "bg-accent-500"}`}>
                      {currentUser.name.charAt(0)}
                    </div>
                    <span className="hidden sm:block font-medium text-gray-700">{currentUser.name}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </>
                ) : (
                  <span className="font-medium text-gray-600">Select User</span>
                )}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Homeowners</p>
                    {homeowners.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setCurrentUser(u); setShowUserMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left ${currentUser?.id === u.id ? "bg-primary-50" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </button>
                    ))}
                    <p className="px-3 py-1 mt-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Trades</p>
                    {trades.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setCurrentUser(u); setShowUserMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left ${currentUser?.id === u.id ? "bg-primary-50" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white text-sm font-bold">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.trade_type} &middot; {u.rating} ★</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            {currentUser && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-900 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && currentUser && (
          <div className="md:hidden border-t border-gray-100 py-2 pb-3">
            {currentUser.role === "homeowner" ? (
              <>
                <Link href="/homeowner" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                  Dashboard
                </Link>
                <Link href="/homeowner/projects/new" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                  New Project
                </Link>
              </>
            ) : (
              <>
                <Link href="/trade/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                  Dashboard
                </Link>
                <Link href="/trade/blocks" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg">
                  Browse Blocks
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
