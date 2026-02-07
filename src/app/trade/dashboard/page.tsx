"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Bid, Appreciation } from "@/lib/types";
import { Briefcase, DollarSign, Heart, Star, Coffee, UtensilsCrossed, Search } from "lucide-react";

export default function TradeDashboard() {
  const { currentUser } = useApp();
  const router = useRouter();
  const [bids, setBids] = useState<(Bid & { block_title?: string; project_title?: string })[]>([]);
  const [appreciations, setAppreciations] = useState<Appreciation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }
    Promise.all([
      fetch(`/api/bids?trade_id=${currentUser.id}`).then((r) => r.json()),
      fetch(`/api/appreciation?to_user_id=${currentUser.id}`).then((r) => r.json()),
    ]).then(([b, a]) => {
      setBids(b);
      setAppreciations(a);
      setLoading(false);
    });
  }, [currentUser, router]);

  if (!currentUser || loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  const activeBids = bids.filter((b) => b.status === "pending");
  const wonBids = bids.filter((b) => b.status === "accepted");
  const totalEarnings = wonBids.reduce((s, b) => s + b.price, 0);
  const totalAppreciation = appreciations.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {currentUser.trade_type} &middot; {currentUser.rating} ★ ({currentUser.rating_count} reviews)
          </p>
        </div>
        <Link href="/trade/blocks" className="btn-primary flex items-center gap-2 w-fit">
          <Search className="w-4 h-4" />
          Browse Available Blocks
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{activeBids.length}</p>
            <p className="text-xs text-gray-500">Active Bids</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">${totalEarnings.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Won Bids</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{wonBids.length}</p>
            <p className="text-xs text-gray-500">Projects Won</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">${totalAppreciation}</p>
            <p className="text-xs text-gray-500">Appreciation</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active / Won Bids */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Bids</h2>
          {bids.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 mb-3">No bids yet.</p>
              <Link href="/trade/blocks" className="btn-primary btn-sm">Browse Available Blocks</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {bids.map((bid) => (
                <Link
                  key={bid.id}
                  href={`/trade/blocks/${bid.block_id}`}
                  className="card !p-4 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{bid.block_title}</p>
                      <p className="text-xs text-gray-500">{bid.project_title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge status={bid.status} />
                        {bid.is_revision ? (
                          <span className="badge bg-orange-100 text-orange-700">Revised</span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900 shrink-0">${bid.price.toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Appreciation Received */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Appreciation Received
          </h2>
          {appreciations.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500">No appreciation rewards yet. Keep up the great work!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {appreciations.map((a) => (
                <div key={a.id} className="card !p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                      {a.type === "coffee" && <Coffee className="w-5 h-5 text-amber-600" />}
                      {a.type === "lunch" && <UtensilsCrossed className="w-5 h-5 text-green-600" />}
                      {a.type === "dinner" && <UtensilsCrossed className="w-5 h-5 text-purple-600" />}
                      {a.type === "custom" && <Heart className="w-5 h-5 text-pink-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {a.type.charAt(0).toUpperCase() + a.type.slice(1)} from {a.from_name}
                        </p>
                        <p className="text-lg font-bold text-green-600">${a.amount}</p>
                      </div>
                      {a.message && (
                        <p className="text-sm text-gray-600 italic mt-1">&ldquo;{a.message}&rdquo;</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {a.project_title && <span>{a.project_title}</span>}
                        <span>Code: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{a.redeem_code}</code></span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Redeem at: The Sawmill Grill, Blueprint Café, Cornerstone Bistro, The Beam & Truss, Level Line Sushi
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
