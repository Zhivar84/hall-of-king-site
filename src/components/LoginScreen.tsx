import React, { useState } from "react";
import { User } from "../types";
import { Tv, Sparkles, UserCheck, Shield, KeyRound, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setError("لطفاً نام کاربری و رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Handle Login
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmedUser, password: trimmedPass }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "خطایی رخ داده است.");
        }

        onLoginSuccess(data.user);
      } else {
        // Handle Registration
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmedUser, password: trimmedPass }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "خطایی رخ داده است.");
        }

        setSuccess(data.message || "ثبت‌نام با موفقیت انجام شد. منتظر تایید مدیر باشید.");
        // Clear inputs and switch to login
        setUsername("");
        setPassword("");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || "برقراری ارتباط با سرور ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden font-sans">
      {/* Background Decorative elements - Dynamic, soft, pulsing ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-900/10 blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-rose-900/10 blur-[100px] animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 shadow-2xl relative z-10"
      >
        {/* Header - Minimalist Hall of Kings emblem */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-950/50 mb-3">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs bg-zinc-900 text-purple-400 border border-purple-950 px-2.5 py-1 rounded font-black tracking-widest uppercase">
            HALL OF KINGS
          </span>
        </div>

        {/* Success/Error Alerts */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>{error}</div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 flex items-start gap-2.5 text-emerald-300 text-xs leading-relaxed"
          >
            <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>{success}</div>
          </motion.div>
        )}

        {/* Title indicating mode */}
        <h2 className="text-lg font-black text-white text-center mb-5 tracking-tight">
          {isLogin ? "ورود به حساب کاربری" : "ایجاد حساب جدید"}
        </h2>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">
              نام کاربری
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: zhivar"
              className="w-full bg-zinc-900/90 border border-zinc-800/80 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/80 transition-all text-right placeholder:text-zinc-600"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">
              رمز عبور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-900/90 border border-zinc-800/80 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/80 transition-all text-right placeholder:text-zinc-600"
              dir="ltr"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-purple-950/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-6 cursor-pointer text-sm"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              "ورود"
            ) : (
              "ثبت‌نام و ارسال درخواست"
            )}
          </button>
        </form>

        {/* Toggle Mode Option below Form */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
            }}
            className="text-xs text-zinc-400 hover:text-purple-400 transition-colors duration-200 underline underline-offset-4 decoration-zinc-800 hover:decoration-purple-500/50"
          >
            {isLogin
              ? "حساب کاربری ندارید؟ ثبت‌نام کنید"
              : "حساب کاربری دارید؟ وارد شوید"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
