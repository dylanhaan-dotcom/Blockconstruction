"use client";

import React, { useEffect } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, HardHat, ArrowRight, Blocks, DollarSign, Clock, Heart, Loader2 } from "lucide-react";

export default function HomePage() {
  const { currentUser, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      if (currentUser.role === "project_owner") {
        router.push("/owner");
      } else {
        router.push("/trade/dashboard");
      }
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

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

          {/* Auth Cards */}
          <div className="mt-12 grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">Project Owners</h2>
              </div>
              <p className="text-sm text-primary-100 mb-4">Create projects, manage blocks, review bids, and reward great work.</p>
              <Link
                href="/signup"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent-500/30 rounded-lg flex items-center justify-center">
                  <HardHat className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">Trade Professionals</h2>
              </div>
              <p className="text-sm text-primary-100 mb-4">Browse available blocks, submit bids, and track your active projects.</p>
              <Link
                href="/signup"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-primary-200 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-white font-medium hover:underline">Sign in</Link>
            </p>
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
