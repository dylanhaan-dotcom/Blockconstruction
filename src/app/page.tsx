"use client";

import React, { useEffect } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { Building2, HardHat, ArrowRight, Blocks, DollarSign, Clock, Heart, Loader2 } from "lucide-react";

export default function HomePage() {
  const { currentUser, setCurrentUser, users, usersLoading } = useApp();
  const router = useRouter();

  const projectOwners = users.filter((u) => u.role === "project_owner");
  const trades = users.filter((u) => u.role === "trade");

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === "project_owner") {
        router.push("/owner");
      } else {
        router.push("/trade/dashboard");
      }
    }
  }, [currentUser, router]);

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Construction, <span className="text-accent-400">Block by Block</span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-primary-100 max-w-2xl mx-auto">
              Break projects into modular blocks. Get competitive bids. Track progress in real-time.
              When plans change, the system adapts automatically.
            </p>
          </div>

          {/* Quick Login Cards */}
          <div className="mt-12 grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">I&apos;m a Project Owner</h2>
              </div>
              <p className="text-sm text-primary-100 mb-4">Create projects, manage blocks, review bids, and reward great work.</p>
              <div className="space-y-2">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-white/60" />
                    <span className="text-sm text-white/60 ml-2">Loading users...</span>
                  </div>
                ) : projectOwners.length === 0 ? (
                  <p className="text-sm text-white/60 py-2">No project owner accounts found. Check server connection.</p>
                ) : (
                  projectOwners.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setCurrentUser(u)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <span className="text-sm font-medium">{u.name}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent-500/30 rounded-lg flex items-center justify-center">
                  <HardHat className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">I&apos;m a Trade</h2>
              </div>
              <p className="text-sm text-primary-100 mb-4">Browse available blocks, submit bids, and track your active projects.</p>
              <div className="space-y-2">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-white/60" />
                    <span className="text-sm text-white/60 ml-2">Loading users...</span>
                  </div>
                ) : trades.length === 0 ? (
                  <p className="text-sm text-white/60 py-2">No trade accounts found. Check server connection.</p>
                ) : (
                  trades.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setCurrentUser(u)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <div className="text-left">
                        <span className="text-sm font-medium">{u.name}</span>
                        <span className="text-xs text-primary-200 ml-2">{u.trade_type}</span>
                      </div>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Blocks className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="font-semibold mb-2">Modular Blocks</h3>
            <p className="text-sm text-gray-600">Break projects into clear, manageable work blocks with dependencies.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-6 h-6 text-accent-600" />
            </div>
            <h3 className="font-semibold mb-2">Competitive Bidding</h3>
            <p className="text-sm text-gray-600">Trades bid on individual blocks. Project owners compare and select the best fit.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="font-semibold mb-2">Dynamic Adjustments</h3>
            <p className="text-sm text-gray-600">When delays happen, downstream trades are auto-notified and can re-bid.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Heart className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="font-semibold mb-2">Appreciation Rewards</h3>
            <p className="text-sm text-gray-600">Reward great trades with coffee, lunch, or dinner at partner restaurants.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
