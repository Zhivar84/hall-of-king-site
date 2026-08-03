import React, { useState, useEffect } from "react";
import { User } from "./types";
import LoginScreen from "./components/LoginScreen";
import AdminPanel from "./components/AdminPanel";
import MangaStream from "./components/MangaStream";
import MangaTimes from "./components/MangaTimes";
import TalarFile from "./components/TalarFile";
import TalarBozorgan from "./components/TalarBozorgan";
import TalarSokhan from "./components/TalarSokhan";
import QuotesTicker from "./components/QuotesTicker";
import ProfileModal from "./components/ProfileModal";
import OnlineUsersModal from "./components/OnlineUsersModal";
import { LogOut, ShieldAlert, Sparkles, Tv, BookOpen, User as UserIcon, Flame, FolderOpen, Users, MessageSquare, Quote, Mic } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"choice" | "stream" | "times" | "file" | "bozorgan" | "sokhan">("choice");
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isOnlineUsersOpen, setIsOnlineUsersOpen] = useState<boolean>(false);

  // Live real-time viewer counts from backend presence
  const [viewers, setViewers] = useState({
    koochak1: 0,
    koochak2: 0,
    bozorg: 0,
  });

  useEffect(() => {
    if (!user) return;

    const clientId = (() => {
      let id = sessionStorage.getItem("manga_client_id");
      if (!id) {
        id = "c_" + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem("manga_client_id", id);
      }
      return id;
    })();

    const updatePresence = async () => {
      try {
        // When on main choice screen, user is in 'none' hall
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            username: user.username,
            hall: activeTab === "stream" ? "koochak_dynamic" : activeTab === "bozorgan" ? "bozorg" : "none" 
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.viewers) {
            setViewers(data.viewers);
            localStorage.setItem("manga_live_viewers", JSON.stringify(data.viewers));
          }
        }
      } catch (e) {
        console.warn("Could not sync presence:", e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 3500);
    return () => clearInterval(interval);
  }, [user, activeTab]);

  // Load persistent user session from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("manga_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem("manga_user");
      }
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem("manga_user", JSON.stringify(loggedInUser));
    setActiveTab("choice");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("manga_user");
    setActiveTab("choice");
    setIsAdminOpen(false);
  };

  // If user is not logged in, render the login & register screens exclusively
  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {activeTab === "stream" && <MangaStream currentUser={user} onBack={() => setActiveTab("choice")} />}
      {activeTab === "times" && <MangaTimes currentUser={user} onBack={() => setActiveTab("choice")} />}
      {activeTab === "file" && <TalarFile currentUser={user} onBack={() => setActiveTab("choice")} />}
      {activeTab === "bozorgan" && <TalarBozorgan currentUser={user} onBack={() => setActiveTab("choice")} />}
      {activeTab === "sokhan" && <TalarSokhan currentUser={user} onBack={() => setActiveTab("choice")} />}

      {activeTab === "choice" && (
        <div className="min-h-screen bg-black text-[#f3f4f6] font-sans relative overflow-hidden flex flex-col justify-between selection:bg-purple-600/30 pb-10 pt-8">
          
          {/* Decorative Blur Backdrops */}
          <div className="absolute top-[-25%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-purple-950/10 blur-[130px] animate-pulse pointer-events-none"></div>
          <div className="absolute bottom-[-25%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-zinc-900/10 blur-[130px] animate-pulse pointer-events-none"></div>

          {/* Dynamic Header */}
          <header className="w-full bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900/60 px-6 py-4 relative z-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between text-right">
              
              {/* User Profile / Status controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-white bg-rose-950/20 hover:bg-rose-600 border border-rose-900/30 px-3.5 py-2 rounded-xl transition-all cursor-pointer font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج از حساب</span>
                </button>

                {user.role === "admin" && (
                  <button
                    onClick={() => setIsAdminOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-white bg-purple-950/30 hover:bg-purple-600 border border-purple-800/40 px-3.5 py-2 rounded-xl transition-all cursor-pointer font-bold animate-pulse"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>پنل مدیریت اعضا</span>
                  </button>
                )}
              </div>

              {/* Profile & Online Users Container */}
              <div className="flex items-center gap-3">
                {/* Online Users Button */}
                <button
                  onClick={() => setIsOnlineUsersOpen(true)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#120f18] hover:bg-zinc-900 border border-zinc-800/60 hover:border-purple-500/40 text-purple-400 hover:text-purple-300 shadow-md transition-all cursor-pointer group"
                  title="افراد آنلاین در سایت"
                >
                  <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full shadow-sm animate-pulse"></span>
                </button>

                {/* User Welcome Greeting / Click to edit profile */}
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-3 group text-right hover:bg-zinc-900/50 p-1.5 px-3 rounded-2xl border border-transparent hover:border-zinc-800/40 transition-all cursor-pointer select-none"
                  title="تنظیمات پروفایل کاربری"
                >
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 group-hover:text-purple-400 transition-colors">سلام، خوش آمدید • ویرایش پروفایل</p>
                    <h3 className="text-sm font-black text-white flex items-center gap-1">
                      <span>{user.nickname || user.username}</span>
                      {user.role === "admin" ? (
                        <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-800/30 px-2 py-0.5 rounded font-bold mr-1">مدیر</span>
                      ) : (
                        <span className="text-[9px] bg-[#221f2d] text-gray-300 border border-[#343045] px-2 py-0.5 rounded mr-1">عضو</span>
                      )}
                    </h3>
                  </div>
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.nickname || user.username}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-[#2d293d] shadow-md group-hover:border-purple-500/50 group-hover:scale-105 transition-all"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white border border-[#2d293d] shadow-md font-bold group-hover:border-purple-500/50 group-hover:scale-105 transition-all">
                      {(user.nickname || user.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
              </div>

            </div>
          </header>

          {/* Main Choice Hub */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 md:py-16 relative z-10 flex flex-col justify-center items-center">
            
            {/* Title greeting banner */}
            <div className="text-center space-y-3 mb-12">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-950/50 border border-purple-800/40 rounded-full text-[11px] text-purple-300 font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="uppercase tracking-wide">پلتفرم خصوصی گروه تالار پادشاهان • Hall of Kings</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                کدام تالار را انتخاب می‌کنید؟
              </h2>
              <p className="text-xs md:text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                از بخش تالار نمایش برای استریم، تالار زمان برای اشتراک‌گذاری فیلم و عکس، تالار فایل برای آپلود اسناد، تالار بزرگان برای ثبت سخنان ماندگار، و تالار سخن برای گفتگوی صوتی و تصویری گروهی استفاده کنید.
              </p>
            </div>

            {/* Responsive grid with 5 choice triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 xl:gap-4 w-full">
              
              {/* TALAR NAMAYESH BUTTON */}
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                onClick={() => setActiveTab("stream")}
                className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between h-[320px] cursor-pointer overflow-hidden text-right"
              >
                {/* Background Light Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-3xl group-hover:bg-red-600/10 transition-all"></div>
                
                <div className="space-y-3.5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-900/40 flex items-center justify-center text-red-400 shadow group-hover:scale-105 transition-transform duration-300">
                    <Tv className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-red-400 font-black tracking-widest font-mono uppercase">SCREEN SHARE & STREAM</span>
                    <h3 className="text-lg font-bold text-white mt-0.5 group-hover:text-red-300 transition-colors">تالار نمایش</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    پخش زنده و به اشتراک‌گذاری صفحه نمایش کامپیوتر با سایر اعضا در اتاق مخصوص.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900/60 relative z-10 w-full">
                  <span className="text-xs font-bold text-red-400 group-hover:-translate-x-1 transition-transform flex items-center gap-1" dir="rtl">
                    <span>ورود به تالار نمایش</span>
                    <span className="text-sm">←</span>
                  </span>
                  <div className="flex items-center gap-1 bg-red-950/60 text-red-300 border border-red-900/30 px-1.5 py-0.5 rounded-full font-bold text-[9px] shrink-0">
                    <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
                    <span>{viewers.koochak1 + viewers.koochak2} زنده</span>
                  </div>
                </div>
              </motion.div>

              {/* TALAR ZAMAN BUTTON */}
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                onClick={() => setActiveTab("times")}
                className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between h-[320px] cursor-pointer overflow-hidden text-right"
              >
                {/* Background Light Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/5 rounded-full blur-3xl group-hover:bg-amber-600/10 transition-all"></div>

                <div className="space-y-3.5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-amber-950/40 border border-amber-900/40 flex items-center justify-center text-amber-400 shadow group-hover:scale-105 transition-transform duration-300">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 font-black tracking-widest font-mono uppercase">VIDEO & PHOTO BOARD</span>
                    <h3 className="text-lg font-bold text-white mt-0.5 group-hover:text-amber-300 transition-colors">تالار زمان</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    محیط اشتراک‌گذاری ویدیوها و تصاویر دلخواه به همراه قابلیت ثبت دیدگاه‌های متنی.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900/60 relative z-10 w-full">
                  <span className="text-xs font-bold text-amber-400 group-hover:-translate-x-1 transition-transform flex items-center gap-1" dir="rtl">
                    <span>ورود به تالار زمان</span>
                    <span className="text-sm">←</span>
                  </span>
                  <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-850/40 px-1.5 py-0.5 rounded-full font-bold shrink-0">گالری</span>
                </div>
              </motion.div>

              {/* TALAR FILE BUTTON */}
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                onClick={() => setActiveTab("file")}
                className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between h-[320px] cursor-pointer overflow-hidden text-right"
              >
                {/* Background Light Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-full blur-3xl group-hover:bg-emerald-600/10 transition-all"></div>

                <div className="space-y-3.5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center text-emerald-400 shadow group-hover:scale-105 transition-transform duration-300">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 font-black tracking-widest font-mono uppercase">FILE ARCHIVE</span>
                    <h3 className="text-lg font-bold text-white mt-0.5 group-hover:text-emerald-300 transition-colors">تالار فایل</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    بارگذاری و دانلود فایل‌ها با لینک مستقیم تا سقف ۵۰ مگابایت. فضایی عالی برای اشتراک‌گذاری اسناد.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900/60 relative z-10 w-full">
                  <span className="text-xs font-bold text-emerald-400 group-hover:-translate-x-1 transition-transform flex items-center gap-1" dir="rtl">
                    <span>ورود به تالار فایل</span>
                    <span className="text-sm">←</span>
                  </span>
                  <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-850/40 px-1.5 py-0.5 rounded-full font-bold shrink-0">بایگانی</span>
                </div>
              </motion.div>

              {/* TALAR BOZORGAN BUTTON */}
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                onClick={() => setActiveTab("bozorgan")}
                className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between h-[320px] cursor-pointer overflow-hidden text-right"
              >
                {/* Background Light Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-3xl group-hover:bg-purple-600/10 transition-all"></div>

                <div className="space-y-3.5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-purple-950/40 border border-purple-900/40 flex items-center justify-center text-purple-400 shadow group-hover:scale-105 transition-transform duration-300">
                    <Quote className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-400 font-black tracking-widest font-mono uppercase">QUOTES & CHAT</span>
                    <h3 className="text-lg font-bold text-white mt-0.5 group-hover:text-purple-300 transition-colors">تالار بزرگان</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    بخش ویژه ثبت سخن بزرگان و گفتگوی متنی متمرکز اعضای تالار پادشاهان.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900/60 relative z-10 w-full">
                  <span className="text-xs font-bold text-purple-400 group-hover:-translate-x-1 transition-transform flex items-center gap-1" dir="rtl">
                    <span>ورود به تالار بزرگان</span>
                    <span className="text-sm">←</span>
                  </span>
                  <div className="flex items-center gap-1 bg-purple-950/60 text-purple-300 border border-purple-900/30 px-1.5 py-0.5 rounded-full font-bold text-[9px] shrink-0">
                    <span className="w-1 h-1 rounded-full bg-purple-500 animate-pulse"></span>
                    <span>{viewers.bozorg} آنلاین</span>
                  </div>
                </div>
              </motion.div>

              {/* TALAR SOKHAN BUTTON */}
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                onClick={() => setActiveTab("sokhan")}
                className="group relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between h-[320px] cursor-pointer overflow-hidden text-right"
              >
                {/* Background Light Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-600/5 rounded-full blur-3xl group-hover:bg-sky-600/10 transition-all"></div>

                <div className="space-y-3.5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-sky-950/40 border border-sky-900/40 flex items-center justify-center text-sky-400 shadow group-hover:scale-105 transition-transform duration-300">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-sky-400 font-black tracking-widest font-mono uppercase">VOICE & WEBCAM CHAT</span>
                    <h3 className="text-lg font-bold text-white mt-0.5 group-hover:text-sky-300 transition-colors">تالار سخن</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    گفتگوی صوتی زنده و اشتراک‌گذاری وب‌کم در کنار صدا با اعضای تالار پادشاهان.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900/60 relative z-10 w-full">
                  <span className="text-xs font-bold text-sky-400 group-hover:-translate-x-1 transition-transform flex items-center gap-1" dir="rtl">
                    <span>ورود به تالار سخن</span>
                    <span className="text-sm">←</span>
                  </span>
                  <div className="flex items-center gap-1.5 bg-sky-950/60 text-sky-300 border border-sky-900/30 px-2 py-0.5 rounded-full font-bold text-[9px] shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                    <span>صوتی</span>
                  </div>
                </div>
              </motion.div>

            </div>
          </main>

          {/* Footer Branding */}
          <footer className="w-full py-6 text-center border-t border-zinc-900 text-[11px] text-zinc-600 relative z-10">
            <p className="flex items-center justify-center gap-1.5">
              <span>ساخته شده با عشق برای اعضای تالار پادشاهان</span>
              <span className="text-purple-500">♥</span>
            </p>
          </footer>

          {/* Admin Panel Overlay Drawer */}
          <AnimatePresence>
            {isAdminOpen && (
              <AdminPanel
                currentUser={user}
                onClose={() => setIsAdminOpen(false)}
              />
            )}
          </AnimatePresence>

          {/* Profile Modal Overlay */}
          <AnimatePresence>
            {isProfileOpen && (
              <ProfileModal
                currentUser={user}
                onClose={() => setIsProfileOpen(false)}
                onUpdateSuccess={(updatedUser) => {
                  setUser(updatedUser);
                  localStorage.setItem("manga_user", JSON.stringify(updatedUser));
                }}
              />
            )}
          </AnimatePresence>

          {/* Online Users Modal Overlay */}
          <AnimatePresence>
            {isOnlineUsersOpen && (
              <OnlineUsersModal
                currentUser={user}
                onClose={() => setIsOnlineUsersOpen(false)}
              />
            )}
          </AnimatePresence>

        </div>
      )}

      <QuotesTicker />
    </>
  );
}
