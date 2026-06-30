import React, { useState, useRef } from "react";
import { User } from "../types";
import { X, Camera, Sparkles, Check, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { motion } from "motion/react";

interface ProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdateSuccess: (updatedUser: User) => void;
}

const PRESET_AVATARS = [
  { name: "گوجو ساتورو", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Gojo" },
  { name: "ناروتو", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Naruto" },
  { name: "لوفی", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Luffy" },
  { name: "میکاسا", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Mikasa" },
  { name: "ساسکه", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Sasuke" },
  { name: "گوکو", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Goku" },
  { name: "زنیتسو", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Zenitsu" },
  { name: "نزوکو", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Nezuko" },
  { name: "گاتس", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Guts" },
  { name: "زورو", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Zoro" },
];

export default function ProfileModal({ currentUser, onClose, onUpdateSuccess }: ProfileModalProps) {
  const [nickname, setNickname] = useState<string>(currentUser.nickname || "");
  const [bio, setBio] = useState<string>(currentUser.bio || "");
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl || "");
  const [customUrlInput, setCustomUrlInput] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB for avatar is plenty
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setError(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 50);
        setUploadProgress(20 + pct);
      }
    };

    reader.onload = async () => {
      try {
        setUploadProgress(80);
        const base64Data = reader.result as string;
        
        const res = await fetch("/api/upload-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            fileData: base64Data
          })
        });

        if (res.ok) {
          const data = await res.json();
          setAvatarUrl(data.url);
          setUploadProgress(100);
          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
          }, 600);
        } else {
          const errData = await res.json();
          setError(errData.error || "خطا در آپلود تصویر.");
          setIsUploading(false);
          setUploadProgress(null);
        }
      } catch (err) {
        setError("برقراری ارتباط با سرور ناموفق بود.");
        setIsUploading(false);
        setUploadProgress(null);
      }
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          avatarUrl: avatarUrl.trim(),
          nickname: nickname.trim(),
          bio: bio.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "بروزرسانی ناموفق بود.");
      }

      setSuccess("پروفایل شما با موفقیت بروزرسانی شد!");
      onUpdateSuccess(data.user);
      
      // Close after delay
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "خطا در برقراری ارتباط با سرور.");
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = () => {
    setAvatarUrl("");
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-right"
      dir="rtl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background ambient light */}
        <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-purple-950/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-64 h-64 bg-indigo-950/20 rounded-full blur-[80px] pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5 shrink-0 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/40 flex items-center justify-center text-purple-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تنظیمات پروفایل کاربری</h3>
              <p className="text-[10px] text-zinc-500 font-medium">پروفایل شخصی خود را برای تالارها شخصی‌سازی کنید</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Container with custom scrollbar */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-6 pr-1 relative z-10 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          
          {/* Status Messages */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/30 flex items-start gap-2.5 text-rose-300 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 flex items-start gap-2.5 text-emerald-300 text-xs leading-relaxed">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Profile Picture Display and Selection */}
          <div className="bg-zinc-900/30 border border-zinc-900/60 rounded-2xl p-4 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar Preview" 
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full object-cover border-2 border-purple-500/50 shadow-xl"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white border-2 border-zinc-800 shadow-xl text-3xl font-black">
                  {(nickname || currentUser.username).charAt(0).toUpperCase()}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-purple-600 hover:bg-purple-500 border border-zinc-950 text-white shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="آپلود عکس"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3.5 py-1.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    <span>آپلود تصویر... ({uploadProgress}%)</span>
                  </>
                ) : (
                  <span>آپلود فایل عکس</span>
                )}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="text-xs bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف تصویر</span>
                </button>
              )}
            </div>
          </div>

          {/* Preset Avatars Grid */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-zinc-400 mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>انتخاب از کاراکترهای انیمه‌ای</span>
            </label>
            <div className="grid grid-cols-5 gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-900">
              {PRESET_AVATARS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(p.url)}
                  className={`relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border transition-all hover:scale-105 ${
                    avatarUrl === p.url ? "border-purple-500 ring-1 ring-purple-500" : "border-zinc-800 hover:border-zinc-700"
                  }`}
                  title={p.name}
                >
                  <img 
                    src={p.url} 
                    alt={p.name} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  {avatarUrl === p.url && (
                    <div className="absolute inset-0 bg-purple-950/40 backdrop-blur-[1px] flex items-center justify-center">
                      <Check className="w-5 h-5 text-white bg-purple-600 rounded-full p-0.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-400 mr-1">
              لینک مستقیم تصویر (اختیاری)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3.5 text-white text-xs font-mono focus:outline-none focus:border-purple-500 transition-all text-left"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => {
                  if (customUrlInput.trim()) {
                    setAvatarUrl(customUrlInput.trim());
                    setCustomUrlInput("");
                  }
                }}
                className="bg-purple-600/20 hover:bg-purple-600 border border-purple-800 text-purple-300 hover:text-white px-4 py-2 rounded-xl text-xs transition-all cursor-pointer font-bold shrink-0"
              >
                اعمال لینک
              </button>
            </div>
          </div>

          {/* Nickname / Bio Input fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2 mr-1">
                نام نمایشی (مستعار / لقب)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="مثال: فرمانروای قلمرو"
                maxLength={20}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-all text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2 mr-1">
                درباره من / وضعیت (Status)
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="چیزی در مورد خودت بنویس..."
                maxLength={100}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-all text-right resize-none"
              />
            </div>
          </div>

        </form>

        {/* Modal Footer / Actions */}
        <div className="flex gap-3 border-t border-zinc-900 pt-4 mt-5 shrink-0 relative z-10">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-xs"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>ذخیره تغییرات</span>
            )}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs transition-all border border-zinc-800 font-bold cursor-pointer"
          >
            انصراف
          </button>
        </div>

      </motion.div>
    </div>
  );
}
