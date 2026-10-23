"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { TRADE_TYPES } from "@/lib/trades";
import { CheckCircle2, HardHat, Plus, Star, X } from "lucide-react";

export default function TradeProfilePage() {
  const { currentUser, loading: sessionLoading, refreshUser } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [secondaryTrades, setSecondaryTrades] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [newCapability, setNewCapability] = useState("");
  const [license, setLicense] = useState("");
  const [insurance, setInsurance] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        setName(p.name || "");
        setTradeType(p.trade_type || "");
        setSecondaryTrades(p.secondary_trades || []);
        setCapabilities(p.capabilities || []);
        setLicense(p.license_info || "");
        setInsurance(p.insurance_info || "");
        setLoading(false);
      });
  }, [currentUser?.id, sessionLoading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a profession that isn't in the standard list selectable
  const tradeOptions = tradeType && !TRADE_TYPES.includes(tradeType) ? [tradeType, ...TRADE_TYPES] : TRADE_TYPES;

  const toggleSecondary = (trade: string) => {
    setSecondaryTrades((prev) => (prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade]));
  };

  const addCapability = () => {
    const value = newCapability.trim();
    if (value && !capabilities.includes(value)) setCapabilities([...capabilities, value]);
    setNewCapability("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        trade_type: tradeType,
        secondary_trades: secondaryTrades.filter((t) => t !== tradeType),
        capabilities,
        license_info: license,
        insurance_info: insurance,
      }),
    });
    if (res.ok) {
      await refreshUser();
      setSaved(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save your profile");
    }
    setSaving(false);
  };

  if (loading || !currentUser) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
        <p className="text-gray-500 text-sm mt-1">
          Your profession and capabilities decide which blocks show up under &ldquo;My trades&rdquo; and what project owners see on your bids.
        </p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <HardHat className="w-4 h-4 text-accent-600" />
            Profession
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Business / Display Name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Primary Profession *</label>
              <select className="input" value={tradeType} onChange={(e) => setTradeType(e.target.value)} required>
                <option value="">Select profession...</option>
                {tradeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="label">Additional Trades</label>
            <p className="text-xs text-gray-500 mb-2">Other kinds of blocks you&apos;re qualified to bid on.</p>
            <div className="flex flex-wrap gap-2">
              {TRADE_TYPES.filter((t) => t !== tradeType).map((t) => {
                const selected = secondaryTrades.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => toggleSecondary(t)}
                    className={`text-sm rounded-full px-3 py-1 border transition-colors ${
                      selected ? "bg-accent-100 border-accent-300 text-accent-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {selected && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Star className="w-4 h-4 text-accent-600" />
            Capabilities
          </h2>
          <p className="text-xs text-gray-500 mb-3">Specialties, equipment, or certifications, e.g. &ldquo;Quartz countertops&rdquo;, &ldquo;Permit pulls&rdquo;, &ldquo;EPA lead-safe certified&rdquo;.</p>
          {capabilities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {capabilities.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 rounded-full pl-3 pr-1.5 py-1">
                  {c}
                  <button
                    type="button"
                    onClick={() => setCapabilities(capabilities.filter((x) => x !== c))}
                    className="p-0.5 rounded-full hover:bg-gray-200"
                    aria-label={`Remove ${c}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="input"
              value={newCapability}
              onChange={(e) => setNewCapability(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCapability();
                }
              }}
              placeholder="Add a capability and press Enter"
            />
            <button type="button" onClick={addCapability} className="btn-secondary flex items-center gap-1 shrink-0">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Credentials</h2>
          <p className="text-xs text-gray-500 -mt-3 mb-4">Pre-filled on new bids.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">License Info</label>
              <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} placeholder="License number" />
            </div>
            <div>
              <label className="label">Insurance Info</label>
              <input className="input" value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="Carrier and policy number" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Profile"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Profile saved
            </span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
