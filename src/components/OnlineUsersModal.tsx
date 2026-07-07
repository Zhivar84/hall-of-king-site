import React, { useState, useEffect } from "react";
import { User } from "../types";
import { X, RefreshCw, Users, ShieldAlert, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface OnlineUser {
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: "admin" | "user";
  hall: "koochak" | "koochak2" | "bozorg" | "none" | string;
}

interface OnlineUsersModalProps {
  currentUser: User;
  onClose: () => void;
}

export default function OnlineUsersModal({ currentUser, onClose }: OnlineUsersModalProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnlineUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/presence/online");
      if (res.ok) {
        const data = await res.json();
        if (data.onlineUsers) {
          // Sort online users: Admins first, then alphabetical
          const sorted = [...data.onlineUsers].sort((a, b) => {
            if (a.role === "admin" && b.role !== "admin") return -1;
            if (a.role !== "admin" && b.role === "admin") return 1;
            const nameA = a.nickname || a.username;
            const nameB = b.nickname || b.username;
            return nameA.localeCompare(nameB, "fa");
          });
          setOnlineUsers(sorted);
        }
      } else {
        setError("خطا در دریافت لیست افراد آنلاین");
      }
    } catch (err) {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlineUsers();
    // Update every 5 seconds while modal is open
    const interval = setInterval(fetchOnlineUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const getHallLabel = (hall: string) => {
    switch (hall) {
      case "koochak":
      case "koochak_dynamic":
        return "📺 در تالار نمایش (استریم)";
      case "bozorg":
        return "💬 در تالار بزرگان";
      case "times":
        return "⏳ در تالار زمان";
      case "file":
        return "📂 در تالار فایل";
      default:
        return "🧭 در حال گشت و گذار";
    }
  };

  const getHallColorClass = (hall: string) => {
    switch (hall) {
      case "koochak":
      case "koochak_dynamic":
        return "text-red-400 bg-red-950/30 border-red-900/30";
      case "bozorg":
        return "text-purple-400 bg-purple-950/30 border-purple-900/30";
      case "times":
        return "text-amber-400 bg-amber-950/30 border-amber-900/30";
      case "file":
        return "text-emerald-400 bg-emerald-950/30 border-emerald-900/30";
      default:
        return "text-zinc-400 bg-zinc-900/30 border-zinc-800/30";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md bg-zinc-950/95 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl z-10 text-right flex flex-col"
        dir="rtl"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-gradient-to-b from-purple-500/10 to-transparent blur-xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-950/40 border border-purple-900/30 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>افراد آنلاین در سایت</span>
                <span className="text-xs font-mono bg-purple-950 text-purple-400 px-2 py-0.5 rounded-full border border-purple-900/30">
                  {onlineUsers.length}
                </span>
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">لیست کاربران فعال تالار پادشاهان</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Refresh Button */}
            <button
              onClick={fetchOnlineUsers}
              disabled={loading}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-850/50 hover:border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="بروزرسانی لیست"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-850/50 hover:border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 max-h-[360px] overflow-y-auto custom-scrollbar relative z-10">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-rose-400 text-xs text-center mb-2">
              {error}
            </div>
          )}

          {loading && onlineUsers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
              <p className="text-xs">در حال دریافت لیست کاربران آنلاین...</p>
            </div>
          ) : onlineUsers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500 text-center">
              <Users className="w-8 h-8 text-zinc-700" />
              <p className="text-xs">هیچ کاربری آنلاین نیست!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {onlineUsers.map((item) => {
                const isSelf = item.username === currentUser.username;
                const displayName = item.nickname || item.username;

                return (
                  <div
                    key={item.username}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSelf
                        ? "bg-purple-950/10 border-purple-900/40"
                        : "bg-zinc-900/30 border-zinc-900/60 hover:bg-zinc-900/50 hover:border-zinc-850"
                    }`}
                  >
                    {/* User Info Right Aligned */}
                    <div className="flex items-center gap-3">
                      {/* Avatar with live pulse */}
                      <div className="relative">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={displayName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-zinc-850 shadow"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white border border-zinc-850 shadow font-bold text-sm">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-emerald-500 border border-zinc-950 rounded-full shadow-sm animate-pulse"></span>
                      </div>

                      {/* Name and role */}
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                          <span>{displayName}</span>
                          {isSelf && (
                            <span className="text-[8px] bg-purple-900/40 text-purple-300 border border-purple-800/30 px-1.5 py-0.5 rounded">
                              شما
                            </span>
                          )}
                          {item.role === "admin" && (
                            <span className="text-[8px] bg-red-950 text-red-400 border border-red-900/30 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              <span>مدیر</span>
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-1 font-mono">@{item.username}</p>
                      </div>
                    </div>

                    {/* Room location Left Aligned */}
                    <div className={`text-[9px] px-2.5 py-1 rounded-full border font-bold ${getHallColorClass(item.hall)}`}>
                      {getHallLabel(item.hall)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/20 border-t border-zinc-900/50 text-center">
          <p className="text-[10px] text-zinc-600 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-500" />
            <span>حفظ حریم خصوصی و امنیت کاربران اولویت ماست</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
