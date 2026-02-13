"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, HardHat, Loader2 } from "lucide-react";

const TRADE_TYPES = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Tile Installer",
  "Painter",
  "Roofer",
  "HVAC Technician",
  "Mason",
  "Landscaper",
  "General Contractor",
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"project_owner" | "trade" | "">("");
  const [tradeType, setTradeType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!role) {
      setError("Please select your role");
      return;
    }

    if (role === "trade" && !tradeType) {
      setError("Please select your trade type");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          trade_type: role === "trade" ? tradeType : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Auto sign in after signup
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign-in failed. Please go to login.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">Join BlockConstruction to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setRole("project_owner"); setTradeType(""); }}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  role === "project_owner"
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Building2 className={`w-6 h-6 mx-auto mb-2 ${role === "project_owner" ? "text-primary-600" : "text-gray-400"}`} />
                <span className={`text-sm font-medium ${role === "project_owner" ? "text-primary-700" : "text-gray-700"}`}>
                  Project Owner
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRole("trade")}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  role === "trade"
                    ? "border-accent-500 bg-accent-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <HardHat className={`w-6 h-6 mx-auto mb-2 ${role === "trade" ? "text-accent-600" : "text-gray-400"}`} />
                <span className={`text-sm font-medium ${role === "trade" ? "text-accent-700" : "text-gray-700"}`}>
                  Trade Professional
                </span>
              </button>
            </div>
          </div>

          {/* Trade Type (conditional) */}
          {role === "trade" && (
            <div>
              <label htmlFor="trade_type" className="block text-sm font-medium text-gray-700 mb-1">
                Trade Type
              </label>
              <select
                id="trade_type"
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select your trade...</option>
                {TRADE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {role === "trade" ? "Business Name" : "Full Name"}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder={role === "trade" ? "Your business name" : "Your full name"}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !role}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
