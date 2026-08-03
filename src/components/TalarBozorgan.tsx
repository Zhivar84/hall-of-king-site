import React, { useState, useEffect, useRef } from "react";
import { User, ChatMessage } from "../types";
import { 
  ArrowLeft, Send, Sparkles, Trash2, MessageSquare, Quote, AlertCircle, CornerUpLeft, Image, X, Smile, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TalarBozorganProps {
  currentUser: User;
  onBack: () => void;
}

interface QuoteType {
  id: string;
  text: string;
  author: string;
  submittedBy: string;
  createdAt: string;
}

const PRESET_GIFS = [
  { name: "خنده", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohhwfWemR7g3AL77G/giphy.gif" },
  { name: "کف زدن", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7qDQ4kcSD1PLM3BK/giphy.gif" },
  { name: "شگفت‌زده", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipOdXMTeQQ4o/giphy.gif" },
  { name: "گریه", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KDRV3Qgh3p0hkAOg6z/giphy.gif" },
  { name: "عالی", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/t3s3X2bVB8XNm/giphy.gif" },
  { name: "موافقت", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppazNM459/giphy.gif" }
];

export default function TalarBozorgan({ currentUser, onBack }: TalarBozorganProps) {
  const [subTab, setSubTab] = useState<"quotes" | "chat">("chat");
  const [quotes, setQuotes] = useState<QuoteType[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [quoteText, setQuoteText] = useState<string>("");
  const [quoteAuthor, setQuoteAuthor] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Reply state
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; text: string } | null>(null);

  // GIF states
  const [gifSelectorOpen, setGifSelectorOpen] = useState<boolean>(false);
  const [uploadingGif, setUploadingGif] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef<string | null>(null);

  // Synchronized viewer counts for Bozorg room
  const [bozorgViewerCount, setBozorgViewerCount] = useState<number>(0);

  useEffect(() => {
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
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            username: currentUser.username,
            hall: "bozorg"
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.viewers) {
            setBozorgViewerCount(data.viewers.bozorg || 0);
            localStorage.setItem("manga_live_viewers", JSON.stringify(data.viewers));
          }
        }
      } catch (e) {
        console.warn("Could not sync bozorg presence:", e);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 3500);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Load all quotes and chat messages
  const loadData = async () => {
    try {
      // Fetch quotes
      const quotesRes = await fetch("/api/quotes");
      let currentQuotes: QuoteType[] = [];
      if (quotesRes.ok) {
        const quotesData = await quotesRes.json();
        currentQuotes = quotesData.quotes || [];
        setQuotes(currentQuotes);
      }

      // Fetch chat
      const chatRes = await fetch("/api/chat?type=bozorgan");
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setChat(chatData.chat || []);
      }
    } catch (err) {
      console.warn("Error loading Talar Bozorgan data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for real-time updates
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of chat only when active and message arrives (using dedicated container ref)
  useEffect(() => {
    if (subTab === "chat" && chat.length > 0) {
      const latestMsg = chat[chat.length - 1];
      if (latestMsg.id !== lastMsgIdRef.current) {
        lastMsgIdRef.current = latestMsg.id;
      }
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [chat, subTab]);

  const handleSendChat = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : chatInput.trim();
    if (!textToSend) return;

    if (customText === undefined) {
      setChatInput("");
    }

    const payload: any = {
      userId: currentUser.id,
      username: currentUser.username,
      text: textToSend,
      type: "bozorgan"
    };

    if (replyTo) {
      payload.replyToId = replyTo.id;
      payload.replyToUser = replyTo.username;
      payload.replyToText = replyTo.text;
      setReplyTo(null);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newMsg = await res.json();
        setChat(prev => [...prev, newMsg]);
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    }
  };

  // Handle GIF file upload
  const handleGifUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "image/gif") {
      alert("لطفاً فقط فایل با پسوند GIF آپلود کنید.");
      return;
    }

    setUploadingGif(true);
    setGifSelectorOpen(false);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const uploadRes = await fetch("/api/upload-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            fileData: base64Data
          })
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.url) {
            handleSendChat(undefined, data.url);
          }
        } else {
          alert("آپلود گیف با خطا مواجه شد.");
        }
        setUploadingGif(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload GIF file:", err);
      setUploadingGif(false);
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim() || !quoteAuthor.trim()) return;

    setErrorMessage("");

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: quoteText.trim(),
          author: quoteAuthor.trim(),
          submittedBy: currentUser.nickname || currentUser.username
        })
      });

      if (res.ok) {
        setQuoteText("");
        setQuoteAuthor("");
        const quotesRes = await fetch("/api/quotes");
        if (quotesRes.ok) {
          const quotesData = await quotesRes.json();
          setQuotes(quotesData.quotes || []);
        }
      } else {
        setErrorMessage("ثبت سخن با خطا مواجه شد.");
      }
    } catch (err) {
      console.error("Failed to add quote:", err);
      setErrorMessage("ارتباط با سرور برقرار نشد.");
    }
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setQuotes(prev => prev.filter(q => q.id !== id));
      } else {
        setErrorMessage("حذف سخن با خطا مواجه شد.");
      }
    } catch (err) {
      console.error("Failed to delete quote:", err);
    }
  };

  return (
    <div className={`bg-black text-[#f3f4f6] font-sans relative flex flex-col selection:bg-purple-600/30 pt-4 pb-4 ${
      subTab === "chat" 
        ? "h-screen overflow-hidden" 
        : "min-h-screen lg:h-screen lg:overflow-hidden"
    }`}>
      
      {/* Decorative Background Glows */}
      <div className="absolute top-[-25%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-purple-950/10 blur-[130px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-25%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-zinc-900/10 blur-[130px] animate-pulse pointer-events-none"></div>

      {/* Header */}
      <header className="bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-900/60 relative z-20 px-4 py-4 md:px-8 shadow-md" dir="rtl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>بازگشت به هاب اصلی</span>
            </button>
          </div>

          {/* Premium Sub-Tab Segmented Selector */}
          <div className="bg-zinc-900/95 p-1 rounded-2xl border border-zinc-800/80 flex items-center gap-1 max-w-sm w-full shadow-inner z-30" dir="rtl">
            <button
              onClick={() => setSubTab("quotes")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                subTab === "quotes"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-950/40"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-850/40"
              }`}
            >
              <Quote className="w-3.5 h-3.5" />
              <span>سخن بزرگان</span>
            </button>
            <button
              onClick={() => setSubTab("chat")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
                subTab === "chat"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-950/40"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-850/40"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>چت بزرگان</span>
              {bozorgViewerCount > 0 && (
                <span className="bg-emerald-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {bozorgViewerCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 select-none self-end sm:self-auto">
            <div className="text-right">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">بخش ویژه تالار بزرگان</span>
              <h1 className="text-sm md:text-base font-black text-white flex items-center gap-2 justify-end">
                <span>{subTab === "quotes" ? "سخن بزرگان" : "چت بزرگان"}</span>
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              </h1>
            </div>
            <div className="w-8 h-8 rounded-xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400 shadow-inner">
              {subTab === "quotes" ? <Quote className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 md:py-6 flex flex-col overflow-hidden relative z-10" dir="rtl">
        <AnimatePresence mode="wait">
          {subTab === "quotes" ? (
            /* SUB-TAB A: SOKHAN BOZORGAN (Quotes manager & list) */
            <motion.div
              key="quotes-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col lg:flex-row gap-6 lg:overflow-hidden"
            >
              {/* Submission Form Container */}
              <div className="w-full lg:w-[380px] bg-zinc-950/65 border border-zinc-900 rounded-3xl p-5 shadow-xl shrink-0 flex flex-col justify-between h-fit lg:max-h-[500px]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                    <h2 className="text-sm font-black text-white">ثبت سخن جدید</h2>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    جملات قصار بزرگان، شاعران، نویسندگان یا سخنان حکیمانه خود را ثبت کنید تا در بالای تمام صفحات وب‌سایت برای همگان نمایش داده شود.
                  </p>

                  {errorMessage && (
                    <div className="bg-red-950/30 border border-red-900/40 text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleAddQuote} className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 mr-1">متن سخن ماندگار</label>
                      <textarea
                        value={quoteText}
                        onChange={(e) => setQuoteText(e.target.value)}
                        placeholder="سخن گرانبها را بنویسید..."
                        rows={3}
                        className="w-full bg-zinc-900/80 border border-zinc-800 text-xs rounded-xl p-3 text-right text-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all resize-none font-medium leading-relaxed"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 mr-1">نام نویسنده یا گوینده</label>
                      <input
                        type="text"
                        value={quoteAuthor}
                        onChange={(e) => setQuoteAuthor(e.target.value)}
                        placeholder="مثلا: فردوسی، افلاطون، شکسپیر"
                        className="w-full bg-zinc-900/80 border border-zinc-800 text-xs rounded-xl p-3 text-right text-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all font-bold"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-xs py-3 rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-purple-950/30 flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>ثبت و ذخیره سخن</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Quotes View Grid / List Container */}
              <div className="flex-1 bg-zinc-950/40 border border-zinc-900 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col lg:overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-900 shrink-0">
                  <h3 className="text-xs font-black text-zinc-400 flex items-center gap-2">
                    <Quote className="w-4 h-4 text-purple-400" />
                    <span>آرشیو تمام سخنان بزرگان</span>
                  </h3>
                  <span className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-900/40 px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {quotes.length} سخن ثبت شده
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1 min-h-[300px] custom-scrollbar">
                  {loading ? (
                    <div className="text-center py-16 text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>در حال دریافت آرشیو سخنان...</span>
                    </div>
                  ) : quotes.length === 0 ? (
                    <div className="text-center py-24 text-xs text-zinc-600 border border-dashed border-zinc-900 rounded-2xl flex flex-col items-center justify-center gap-2">
                      <Quote className="w-10 h-10 text-zinc-800" />
                      <span>هنوز هیچ سخنی ثبت نشده است. اولین سخن را بنویسید!</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {quotes.map((q) => {
                        const isOwner = q.submittedBy === currentUser.username || q.submittedBy === currentUser.nickname || currentUser.role === "admin";
                        return (
                          <motion.div
                            key={q.id}
                            layout
                            className="bg-zinc-950/80 border border-zinc-900/80 hover:border-purple-900/30 rounded-2xl p-4 flex flex-col justify-between relative group transition-all duration-300 shadow-sm"
                          >
                            <p className="text-xs text-zinc-100 leading-relaxed font-semibold pl-4">« {q.text} »</p>
                            
                            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-3 mt-3 border-t border-zinc-900/60">
                              <span>نویسنده: <strong className="text-purple-400 font-bold">{q.author}</strong></span>
                              <span className="text-[9px] text-zinc-600">توسط: {q.submittedBy}</span>
                            </div>

                            {isOwner && (
                              <button
                                onClick={() => handleDeleteQuote(q.id)}
                                className="absolute top-3 left-3 p-1.5 bg-zinc-900 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="حذف سخن"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            /* SUB-TAB B: CHAT BOZORGAN (Focused text chat room) */
            <motion.div
              key="chat-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="flex-1 bg-zinc-950/40 border border-zinc-900 rounded-3xl p-4 md:p-6 shadow-xl flex flex-col overflow-hidden max-w-4xl w-full mx-auto"
            >
              {/* Chat Subheader info */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-4 border-b border-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-black text-white">اتاق گفتگوی بزرگ‌ زادگان</h3>
                </div>
                <div className="flex items-center gap-2 bg-purple-950/80 text-purple-400 border border-purple-900/40 px-3 py-1 rounded-full text-[10px] font-bold font-sans animate-pulse">
                  <Eye className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>{bozorgViewerCount} آنلاین در اتاق چت</span>
                </div>
              </div>

              {/* Chat Area Box */}
              <div className="flex-1 bg-black/40 border border-zinc-900/80 rounded-2xl flex flex-col overflow-hidden min-h-0 mt-4 relative">
                
                {/* Messages Container */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/15">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-2">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-zinc-500">در حال دریافت گفتگو...</p>
                    </div>
                  ) : chat.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
                      <MessageSquare className="w-10 h-10 text-zinc-850" />
                      <p className="text-xs text-zinc-600">هنوز گفتگویی در تالار چت صورت نگرفته است. آغازکننده باشید!</p>
                    </div>
                  ) : (
                    chat.map((msg) => {
                      const isCurrentUser = msg.username === currentUser.username;
                      const isSys = msg.username === "سیستم";
                      const isGif = msg.text.startsWith("http") || msg.text.startsWith("/uploads") || msg.text.includes(".gif");
                      
                      if (isSys) {
                        return (
                          <div key={msg.id} className="flex justify-center my-1 select-none w-full">
                            <span className="bg-[#121016]/80 backdrop-blur-md border border-zinc-900/50 rounded-full px-3 py-0.5 text-[9px] text-zinc-400 text-center">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={`w-full flex ${isCurrentUser ? "justify-start" : "justify-end"}`}>
                          <div className={`flex items-start gap-2.5 max-w-[85%] relative group/msg ${isCurrentUser ? "flex-row text-right" : "flex-row-reverse text-right"}`}>
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${
                              isCurrentUser 
                                ? "from-purple-900 to-indigo-950 border-purple-850 text-purple-300" 
                                : "from-zinc-900 to-zinc-850 border-zinc-800 text-purple-400"
                            } border flex items-center justify-center text-xs font-black shrink-0 select-none shadow`}>
                              {msg.username.substring(0, 1).toUpperCase()}
                            </div>

                            <div className={`flex flex-col ${isCurrentUser ? "items-start" : "items-end"}`}>
                              {/* Header metadata */}
                              <div className="flex items-center gap-1.5 mb-0.5 select-none px-1">
                                <span className={`text-[10px] font-bold ${isCurrentUser ? "text-purple-400" : "text-zinc-400"}`}>
                                  {isCurrentUser ? "شما" : msg.username}
                                </span>
                                <span className="text-[8px] text-zinc-600 font-mono">
                                  {new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {/* Bubble and reply */}
                              <div className="relative group/bubble">
                                <div className={`p-2.5 rounded-2xl shadow-sm text-[11px] leading-relaxed break-words ${
                                  isCurrentUser 
                                    ? "bg-gradient-to-br from-purple-600 to-indigo-650 text-white rounded-tr-none shadow-purple-950/10 font-medium" 
                                    : "bg-zinc-900/90 border border-zinc-850 text-zinc-100 rounded-tl-none"
                                }`}>
                                  
                                  {msg.replyToText && (
                                    <div className={`border-r-2 pr-2 pl-1 py-1 rounded-lg text-[9px] mb-2 max-w-full truncate leading-normal ${
                                      isCurrentUser 
                                        ? "bg-purple-900/40 border-white text-white/90" 
                                        : "bg-black/40 border-purple-500 text-zinc-400"
                                    }`}>
                                      پاسخ به <strong className={isCurrentUser ? "text-purple-200" : "text-purple-400"}>{msg.replyToUser}</strong>: {msg.replyToText}
                                    </div>
                                  )}

                                  {isGif ? (
                                    <div className="p-0.5 overflow-hidden rounded-lg">
                                      <img
                                        src={msg.text}
                                        alt="uploaded gif"
                                        referrerPolicy="no-referrer"
                                        className="rounded-lg max-w-[180px] max-h-[140px] object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <span>{msg.text}</span>
                                  )}
                                </div>

                                <button
                                  onClick={() => setReplyTo({ id: msg.id, username: msg.username, text: msg.text })}
                                  className={`absolute -top-1.5 opacity-0 group-hover/msg:opacity-100 transition-all p-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white cursor-pointer shadow-xl z-10 ${
                                    isCurrentUser ? "-left-6" : "-right-6"
                                  }`}
                                  title="پاسخ به این پیام"
                                >
                                  <CornerUpLeft className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Uploading GIF status */}
                {uploadingGif && (
                  <div className="bg-purple-950/30 border-t border-purple-900/30 text-purple-300 text-[10px] px-4 py-2 flex items-center gap-2 animate-pulse justify-center shrink-0">
                    <Smile className="w-4 h-4 animate-spin" />
                    <span>در حال بارگذاری فایل گیف و ارسال...</span>
                  </div>
                )}

                {/* Replying ribbon */}
                {replyTo && (
                  <div className="bg-purple-950/50 border-t border-purple-900/40 px-4 py-2 flex items-center justify-between text-xs text-purple-300 relative z-10 shrink-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <CornerUpLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>پاسخ به <strong className="font-extrabold text-white">{replyTo.username}</strong>:</span>
                      <span className="truncate max-w-[200px] text-[10px] text-zinc-400">"{replyTo.text}"</span>
                    </div>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="p-1 hover:bg-purple-900/30 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Chat input forms & Accessories */}
                <div className="p-3 bg-zinc-950 border-t border-zinc-900 relative shrink-0">
                  
                  {/* GIF Selector Overlay */}
                  {gifSelectorOpen && (
                    <div className="absolute bottom-[100%] right-3 left-3 bg-zinc-950 border border-zinc-900 rounded-2xl p-3 shadow-2xl space-y-3 z-30 mb-2 max-w-sm">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-[10px] font-black text-purple-400">انتخاب یا بارگذاری گیف</span>
                        <button
                          onClick={() => setGifSelectorOpen(false)}
                          className="text-zinc-500 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_GIFS.map((g) => (
                          <button
                            key={g.name}
                            type="button"
                            onClick={() => {
                              handleSendChat(undefined, g.url);
                              setGifSelectorOpen(false);
                            }}
                            className="bg-zinc-900 hover:bg-purple-950/20 border border-zinc-800 hover:border-purple-900/30 rounded-xl p-1 text-center transition-all cursor-pointer relative group overflow-hidden"
                          >
                            <img
                              src={g.url}
                              alt={g.name}
                              className="w-full h-10 object-cover rounded-lg mb-1"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[8px] text-zinc-400 font-bold group-hover:text-purple-300">{g.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="border-t border-zinc-900 pt-2.5">
                        <label className="flex items-center justify-center gap-2 bg-purple-950/50 hover:bg-purple-900/40 border border-purple-900/30 rounded-xl px-3 py-2 cursor-pointer text-[10px] font-bold text-purple-300 hover:text-white transition-all text-center w-full">
                          <Image className="w-4 h-4" />
                          <span>بارگذاری فایل GIF سفارشی</span>
                          <input
                            type="file"
                            accept="image/gif"
                            onChange={handleGifUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Input form element */}
                  <form onSubmit={(e) => handleSendChat(e)} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGifSelectorOpen(!gifSelectorOpen)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                        gifSelectorOpen 
                          ? "bg-purple-900/30 border-purple-700 text-purple-400" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                      }`}
                      title="ارسال GIF"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="پیامی بنویسید..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-4 py-3 text-right text-white focus:outline-none focus:border-purple-600 transition-all font-medium"
                    />

                    <button
                      type="submit"
                      className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center shadow-lg shadow-purple-950/20 shrink-0"
                    >
                      <Send className="w-4 h-4 rotate-180" />
                    </button>
                  </form>

                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}
