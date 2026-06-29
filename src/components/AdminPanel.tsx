import React, { useState, useEffect } from "react";
import { User } from "../types";
import { X, Check, Ban, Trash2, ShieldAlert, UserCheck, Shield, Users, Search, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface AdminPanelProps {
  currentUser: User;
  onClose: () => void;
}

export default function AdminPanel({ currentUser, onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("بارگذاری لیست کاربران موفقیت‌آمیز نبود.");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "خطایی در دریافت اطلاعات رخ داد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("تایید کاربر ناموفق بود.");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "approved" } : u));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("رد کاربر ناموفق بود.");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "rejected" } : u));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: "admin" | "user") => {
    setActionLoading(userId);
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("تغییر نقش ناموفق بود.");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string, username: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "حذف کاربر ناموفق بود.");
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  // Statistics
  const pendingCount = users.filter(u => u.status === "pending").length;
  const approvedCount = users.filter(u => u.status === "approved").length;
  const totalCount = users.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0c0a0f]/85 backdrop-blur-md flex items-center justify-center p-4 font-sans text-right"
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-[#13111a] border border-[#262333] w-full max-w-4xl rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#262333] flex items-center justify-between bg-[#191624]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">پنل مدیریت اعضا</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#252233] text-gray-400 hover:text-white hover:bg-[#2e2b3f] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status bar */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-[#171420] border-b border-[#262333]">
          <div className="p-3 rounded-xl bg-[#201d2d] border border-[#2d293f] flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400">کل اعضا</p>
              <h3 className="text-xl font-black text-white font-mono mt-0.5">{totalCount}</h3>
            </div>
            <Users className="w-8 h-8 text-purple-400/30" />
          </div>

          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-amber-300">در انتظار تایید</p>
              <h3 className="text-xl font-black text-amber-400 font-mono mt-0.5">{pendingCount}</h3>
            </div>
            <RefreshCw className="w-8 h-8 text-amber-400/20 animate-spin-slow" />
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-300">فعال و تایید شده</p>
              <h3 className="text-xl font-black text-emerald-400 font-mono mt-0.5">{approvedCount}</h3>
            </div>
            <UserCheck className="w-8 h-8 text-emerald-400/20" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-[#262333] flex gap-3 bg-[#110f17]">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="جستجوی نام کاربری..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1b1924] border border-[#2a2738] rounded-xl py-2 px-10 text-white text-sm focus:outline-none focus:border-purple-500 transition-all text-right"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
          </div>
          <button
            onClick={fetchUsers}
            className="px-3 rounded-xl bg-[#201d2d] hover:bg-[#2d293f] text-white border border-[#2d293f] flex items-center justify-center cursor-pointer transition-all"
            title="به‌روزرسانی"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Main list area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-xs">در حال بارگذاری لیست اعضا...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/20 border border-rose-800/30 text-rose-300 rounded-xl text-center text-xs flex flex-col items-center justify-center py-10 gap-2">
              <AlertCircle className="w-6 h-6 text-rose-400" />
              <p>{error}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-gray-500 py-16 text-xs bg-[#171521]/40 rounded-xl border border-dashed border-[#262333]">
              کاربری یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#262333] text-gray-400 text-xs font-bold">
                    <th className="pb-3 text-right">نام کاربری</th>
                    <th className="pb-3 text-center">وضعیت حساب</th>
                    <th className="pb-3 text-center">نقش کاربری</th>
                    <th className="pb-3 text-left pl-2">عملیات مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#211e2b]/50">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="text-sm hover:bg-[#1a1724]/40 transition-colors">
                      <td className="py-3.5 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {user.role === "admin" ? (
                            <Shield className="w-4 h-4 text-purple-400 shrink-0" title="مدیر" />
                          ) : (
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full shrink-0"></div>
                          )}
                          <span>{user.username}</span>
                          {user.id === currentUser.id && (
                            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/40 px-1.5 py-0.5 rounded">شما</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        {user.status === "approved" && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            تایید شده
                          </span>
                        )}
                        {user.status === "pending" && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-950/40 text-amber-300 border border-amber-800/40 font-medium animate-pulse">
                            منتظر تایید
                          </span>
                        )}
                        {user.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-rose-950/40 text-rose-300 border border-rose-800/40 font-medium">
                            رد شده
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                          user.role === "admin" ? "bg-purple-950 text-purple-300 border border-purple-800/30" : "bg-[#201d2d] text-gray-300"
                        }`}>
                          {user.role === "admin" ? "ADMIN" : "USER"}
                        </span>
                      </td>
                      <td className="py-3.5 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Approve/Reject Buttons for Pending/Rejected */}
                          {user.status !== "approved" && (
                            <button
                              disabled={actionLoading !== null}
                              onClick={() => handleApprove(user.id)}
                              className="p-1.5 rounded bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/40 hover:text-emerald-300 transition-all cursor-pointer text-xs flex items-center gap-1"
                              title="تایید حساب"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>تایید</span>
                            </button>
                          )}

                          {user.status !== "rejected" && user.id !== "admin" && (
                            <button
                              disabled={actionLoading !== null}
                              onClick={() => handleReject(user.id)}
                              className="p-1.5 rounded bg-rose-900/20 text-rose-400 hover:bg-rose-900/40 border border-rose-850 text-rose-300 transition-all cursor-pointer text-xs flex items-center gap-1"
                              title="رد درخواست"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>رد کردن</span>
                            </button>
                          )}

                          {/* Promote/Demote buttons */}
                          {user.status === "approved" && user.id !== "admin" && (
                            <button
                              disabled={actionLoading !== null}
                              onClick={() => handleToggleRole(user.id, user.role)}
                              className="p-1.5 rounded bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 border border-purple-850 text-purple-300 transition-all cursor-pointer text-xs flex items-center gap-1"
                              title="تغییر نقش کاربری"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>{user.role === "admin" ? "عادی کردن" : "مدیر کردن"}</span>
                            </button>
                          )}

                          {/* Delete account */}
                          {user.id !== "admin" && user.id !== currentUser.id && (
                            deletingUserId === user.id ? (
                              <div className="flex items-center gap-1 bg-zinc-900 px-1.5 py-0.5 rounded border border-rose-900/30">
                                <span className="text-[10px] text-rose-450 ml-1">حذف؟</span>
                                <button
                                  onClick={() => {
                                    handleDelete(user.id, user.username);
                                    setDeletingUserId(null);
                                  }}
                                  className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded text-xs hover:bg-rose-900 cursor-pointer"
                                >
                                  بله
                                </button>
                                <button
                                  onClick={() => setDeletingUserId(null)}
                                  className="bg-zinc-850 text-zinc-400 px-2 py-0.5 rounded text-xs hover:bg-zinc-700 cursor-pointer"
                                  disabled={actionLoading !== null}
                                >
                                  خیر
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={actionLoading !== null}
                                onClick={() => setDeletingUserId(user.id)}
                                className="p-1.5 rounded bg-[#1f1a1d] text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-all cursor-pointer"
                                title="حذف کامل حساب"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
