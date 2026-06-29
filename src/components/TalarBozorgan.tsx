import React, { useState, useEffect, useRef } from "react";
import { User, ChatMessage, Quote } from "../types";
import { 
  ArrowLeft, Send, Search, Users, User as UserIcon, MessageSquare, 
  Smile, Image as ImageIcon, ShieldAlert, Sparkles, MessageCircle,
  Quote as QuoteIcon, Trash2, PlusCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TalarBozorganProps {
  currentUser: User;
  onBack: () => void;
}

export default function TalarBozorgan({ currentUser, onBack }: TalarBozorganProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showMembers, setShowMembers] = useState<boolean>(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  
  // Quotes (Sokhan Bozorgan) states
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState<boolean>(true);
  const [showQuotesMobile, setShowQuotesMobile] = useState<boolean>(false);
  const [showAddQuote, setShowAddQuote] = useState<boolean>(false);
  const [newQuoteText, setNewQuoteText] = useState<string>("");
  const [newQuoteAuthor, setNewQuoteAuthor] = useState<string>("");
  const [quoteError, setQuoteError] = useState<string>("");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState<boolean>(false);

  // GIF Library states
  const [showGifPanel, setShowGifPanel] = useState<boolean>(false);
  const [sharedGifs, setSharedGifs] = useState<any[]>([]);
  const [gifsLoading, setGifsLoading] = useState<boolean>(false);
  const [showAddGifForm, setShowAddGifForm] = useState<boolean>(false);
  const [newGifUrl, setNewGifUrl] = useState<string>("");
  const [newGifName, setNewGifName] = useState<string>("");
  const [gifSubmitError, setGifSubmitError] = useState<string>("");
  const [isSubmittingGif, setIsSubmittingGif] = useState<boolean>(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [deletingGifId, setDeletingGifId] = useState<string | null>(null);

  const loadGifs = async () => {
    try {
      setGifsLoading(true);
      const res = await fetch("/api/gifs");
      if (res.ok) {
        const data = await res.json();
        setSharedGifs(data.gifs || []);
      }
    } catch (err) {
      console.error("Error loading GIFs:", err);
    } finally {
      setGifsLoading(false);
    }
  };

  useEffect(() => {
    if (showGifPanel) {
      loadGifs();
    }
  }, [showGifPanel]);

  const handleSelectGif = async (gifUrl: string) => {
    if (isSending) return;
    try {
      setIsSending(true);
      const payload = {
        userId: currentUser.id,
        username: currentUser.username,
        text: gifUrl,
        type: "bozorgan"
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setShowGifPanel(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddGifSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGifUrl.trim() || !newGifName.trim() || isSubmittingGif) return;

    if (!newGifUrl.trim().startsWith("http")) {
      setGifSubmitError("آدرس گیف باید با http:// یا https:// شروع شود.");
      return;
    }

    try {
      setIsSubmittingGif(true);
      setGifSubmitError("");

      const res = await fetch("/api/gifs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newGifUrl.trim(),
          name: newGifName.trim(),
          addedBy: currentUser.username
        })
      });

      if (res.ok) {
        const newGif = await res.json();
        setSharedGifs(prev => [...prev, newGif]);
        setNewGifUrl("");
        setNewGifName("");
        setShowAddGifForm(false);
      } else {
        const data = await res.json();
        setGifSubmitError(data.error || "خطا در ثبت گیف جدید.");
      }
    } catch (err) {
      console.error(err);
      setGifSubmitError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setIsSubmittingGif(false);
    }
  };

  const handleDeleteGif = async (e: React.MouseEvent, gifId: string) => {
    e.stopPropagation();

    try {
      const res = await fetch(`/api/gifs/${gifId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSharedGifs(prev => prev.filter(g => g.id !== gifId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isGifUrl = (text: string) => {
    const cleaned = text.trim();
    return (
      cleaned.startsWith("http") && (
        cleaned.toLowerCase().endsWith(".gif") || 
        cleaned.includes("giphy.com/media/") ||
        cleaned.includes("tenor.com/view") ||
        cleaned.toLowerCase().includes(".gif?")
      )
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat messages
  const loadMessages = async () => {
    try {
      const res = await fetch("/api/chat?type=bozorgan");
      if (res.ok) {
        const data = await res.json();
        const chatMsgs = data.chat || [];
        setMessages(chatMsgs);

        // Extract active users in chat
        const users = Array.from(new Set(chatMsgs.map((m: any) => m.username))) as string[];
        setActiveUsers(users);
      }
    } catch (err) {
      console.error("Error loading chat messages:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load quotes from DB
  const loadQuotes = async () => {
    try {
      const res = await fetch("/api/quotes");
      if (res.ok) {
        const data = await res.json();
        setQuotes(data.quotes || []);
      }
    } catch (err) {
      console.error("Error loading quotes:", err);
    } finally {
      setQuotesLoading(false);
    }
  };

  // Poll for new messages and quotes every 4 seconds
  useEffect(() => {
    loadMessages();
    loadQuotes();
    const interval = setInterval(() => {
      loadMessages();
      loadQuotes();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom whenever messages load or are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    try {
      setIsSending(true);
      const payload = {
        userId: currentUser.id,
        username: currentUser.username,
        text: inputText.trim(),
        type: "bozorgan"
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setInputText("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const filteredMessages = messages.filter(msg =>
    msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim() || !newQuoteAuthor.trim() || isSubmittingQuote) return;

    try {
      setIsSubmittingQuote(true);
      setQuoteError("");

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newQuoteText.trim(),
          author: newQuoteAuthor.trim(),
          submittedBy: currentUser.username
        })
      });

      if (res.ok) {
        const addedQuote = await res.json();
        setQuotes(prev => [addedQuote, ...prev]);
        setNewQuoteText("");
        setNewQuoteAuthor("");
        setShowAddQuote(false);
      } else {
        const errData = await res.json();
        setQuoteError(errData.error || "خطایی رخ داد.");
      }
    } catch (err) {
      console.error(err);
      setQuoteError("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setQuotes(prev => prev.filter(q => q.id !== quoteId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#070609] text-[#f3f4f6] font-sans flex flex-col justify-between h-screen overflow-hidden">
      
      {/* Header Bar */}
      <div className="bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900/80 px-4 py-3 md:px-8 flex items-center justify-between shadow-md shrink-0">
        
        {/* Left: Go Back & Quotes Mobile Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/60 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>برگشت</span>
          </button>

          {/* Quotes Toggle Button for smaller screens */}
          <button
            onClick={() => setShowQuotesMobile(true)}
            className="lg:hidden flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-900/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            title="سخن بزرگان"
          >
            <QuoteIcon className="w-4 h-4 text-indigo-400" />
            <span>سخن بزرگان</span>
          </button>
        </div>

        {/* Center: Info */}
        <div className="flex items-center gap-3 text-right">
          <div className="hidden md:block">
            <h2 className="text-sm font-black text-white flex items-center justify-end gap-1.5">
              <span>گروه تالار بزرگـان</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">{activeUsers.length} عضو فعال اخیر</p>
          </div>
          
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-purple-900/40 flex items-center justify-center text-purple-400 shadow shadow-purple-950/40">
            <Users className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main Body Grid */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Sidebar: Sokhan Bozorgan (Desktop) */}
        <div className="w-72 bg-zinc-950 border-r border-zinc-900 overflow-y-auto hidden lg:flex flex-col text-right p-4 space-y-4 shrink-0 justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 border-b border-zinc-900 pb-2 mb-2">
              <button 
                onClick={() => setShowAddQuote(true)}
                className="text-[10px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded-full hover:bg-indigo-900 transition-colors cursor-pointer flex items-center gap-1 font-bold"
              >
                <PlusCircle className="w-3 h-3" />
                <span>افزودن</span>
              </button>
              <span className="flex items-center gap-1.5">
                <span>سخن بزرگان</span>
                <QuoteIcon className="w-3.5 h-3.5 text-indigo-400" />
              </span>
            </div>

            {/* Quotes list */}
            <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
              {quotesLoading ? (
                <p className="text-[10px] text-zinc-500 text-center py-4">در حال بارگذاری سخنان...</p>
              ) : quotes.length === 0 ? (
                <p className="text-[10px] text-zinc-600 text-center py-4">هنوز هیچ سخنی ثبت نشده است.</p>
              ) : (
                quotes.map((q) => (
                  <div key={q.id} className="bg-zinc-900/30 hover:bg-zinc-900/60 transition-all border border-zinc-900/50 p-3 rounded-xl space-y-2 group relative">
                    <p className="text-xs text-zinc-300 leading-relaxed text-right font-serif italic">
                      «{q.text}»
                    </p>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500">
                      {(q.submittedBy === currentUser.username || currentUser.role === "admin") ? (
                        deletingQuoteId === q.id ? (
                          <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-rose-950/40">
                            <span className="text-[8px] text-rose-400">حذف؟</span>
                            <button
                              onClick={() => {
                                handleDeleteQuote(q.id);
                                setDeletingQuoteId(null);
                              }}
                              className="bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded text-[8px] hover:bg-rose-900 cursor-pointer"
                            >
                              بله
                            </button>
                            <button
                              onClick={() => setDeletingQuoteId(null)}
                              className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] hover:bg-zinc-700 cursor-pointer"
                            >
                              خیر
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingQuoteId(q.id)}
                            className="text-zinc-500 hover:text-rose-450 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="حذف سخن"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      ) : <span />}
                      <span className="font-bold text-indigo-400">— {q.author}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Members list (Desktop or toggled) */}
        <AnimatePresence>
          {(showMembers || !showMembers) && (
            <div className={`w-64 bg-zinc-950 border-l border-zinc-900 overflow-y-auto hidden md:block text-right p-4 space-y-4 shrink-0`}>
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 border-b border-zinc-900 pb-2 mb-2">
                <span className="text-[10px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded-full">{activeUsers.length}</span>
                <span>هم‌صحبت‌ها</span>
              </div>
              
              <div className="space-y-2">
                {activeUsers.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/40 border border-zinc-900/20">
                    <span className="text-[9px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded-full font-bold">آنلاین</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-300">{user}</span>
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white">
                        {user.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Chat Stream Screen */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
          
          {/* Internal search filter bar */}
          <div className="bg-zinc-950/40 border-b border-zinc-900/40 px-4 py-2 flex items-center justify-end shrink-0 gap-2">
            <div className="relative w-48 md:w-64">
              <input
                type="text"
                placeholder="جستجو در پیام‌ها..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/75 border border-zinc-850 rounded-lg py-1 px-8 text-white text-xs text-right focus:outline-none focus:border-indigo-600 transition-colors"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
            </div>
          </div>

          {/* Messages container scrollable */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gradient-to-b from-[#08070b] to-[#040406]">
            {loading ? (
              <div className="text-center text-zinc-500 text-xs py-10">در حال بارگذاری پیام‌ها...</div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-xs">
                {searchQuery ? "پیامی پیدا نشد." : "هیچ پیامی هنوز ارسال نشده است. اولین پیام را ارسال کنید!"}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredMessages.map((msg) => {
                  const isMe = msg.username === currentUser.username;
                  const isGif = isGifUrl(msg.text);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 15, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      layout
                      className={`flex items-start gap-2.5 max-w-[85%] md:max-w-[70%] ${
                        isMe ? "ml-auto flex-row" : "mr-auto flex-row"
                      }`}
                    >
                      
                      {/* Avatar for others */}
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 border border-indigo-700/30 flex items-center justify-center text-xs text-white font-extrabold shrink-0 shadow">
                          {getInitials(msg.username)}
                        </div>
                      )}

                      {/* Bubble Content */}
                      <div className="space-y-1">
                        
                        {/* Name of sender */}
                        {!isMe && (
                          <span className="block text-[10px] font-bold text-indigo-400 text-right pr-1">
                            {msg.username}
                          </span>
                        )}

                        {/* Chat box / GIF display */}
                        {isGif ? (
                          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 p-1 shadow-lg group">
                            <img
                              src={msg.text.trim()}
                              alt="GIF"
                              className="max-h-48 md:max-h-60 object-contain rounded-xl max-w-full"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-1.5 right-2 bg-black/70 backdrop-blur-md text-[8px] px-1.5 py-0.5 rounded-full font-bold text-zinc-400">
                              GIF
                            </div>
                            <span className="absolute bottom-1.5 left-2 bg-black/70 backdrop-blur-md text-[8px] px-1.5 py-0.5 rounded-full font-mono text-zinc-400">
                              {new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          /* Chat text box */
                          <div
                            className={`p-3 rounded-2xl shadow-lg relative leading-relaxed text-xs text-right break-words ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-tr-none"
                                : "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none"
                            }`}
                          >
                            <p>{msg.text}</p>
                            
                            {/* Timestamp */}
                            <span className={`block text-[8px] mt-1.5 font-mono text-left ${isMe ? "text-indigo-200" : "text-zinc-500"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                      </div>

                      {/* Avatar for me */}
                      {isMe && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 border border-indigo-700/30 flex items-center justify-center text-xs text-white font-extrabold shrink-0 shadow">
                          {getInitials(msg.username)}
                        </div>
                      )}

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Shared GIF Selection Panel Drawer */}
          <AnimatePresence>
            {showGifPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-zinc-950 border-t border-zinc-900/80 overflow-hidden shrink-0"
              >
                <div className="p-4 max-w-4xl mx-auto space-y-3 text-right">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <button
                      type="button"
                      onClick={() => setShowAddGifForm(!showAddGifForm)}
                      className="text-[10px] bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 px-3 py-1.5 rounded-xl border border-amber-500/20 transition-all font-bold cursor-pointer flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{showAddGifForm ? "بازگشت به لیست" : "افزودن گیف جدید"}</span>
                    </button>
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <span>کتابخانه گیف‌های تالار</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    </span>
                  </div>

                  {/* Add New GIF Form */}
                  {showAddGifForm ? (
                    <form onSubmit={handleAddGifSubmit} className="bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-900 space-y-3">
                      <h4 className="text-[11px] font-bold text-zinc-300">افزودن گیف سفارشی برای استفاده همگان</h4>
                      
                      {gifSubmitError && (
                        <div className="bg-rose-950/30 border border-rose-900/40 text-rose-300 text-[10px] py-2 px-3 rounded-xl">
                          {gifSubmitError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] text-zinc-500 text-right">آدرس اینترنتی گیف (GIF URL)</label>
                          <input
                            type="url"
                            required
                            placeholder="https://example.com/anime.gif"
                            value={newGifUrl}
                            onChange={(e) => setNewGifUrl(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-white text-left focus:outline-none focus:border-amber-600 font-mono"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] text-zinc-500 text-right">نام یا هشتگ گیف</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: لوفی خوشحال"
                            value={newGifName}
                            onChange={(e) => setNewGifName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-white text-right focus:outline-none focus:border-amber-600"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={isSubmittingGif}
                          className="bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-xs font-bold text-white py-2 px-6 rounded-xl cursor-pointer"
                        >
                          {isSubmittingGif ? "در حال ثبت..." : "افزودن به لیست عمومی"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* GIFs Grid */
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
                      {gifsLoading ? (
                        <div className="col-span-full text-center text-zinc-600 text-[10px] py-6">در حال بارگذاری گیف‌ها...</div>
                      ) : sharedGifs.length === 0 ? (
                        <div className="col-span-full text-center text-zinc-600 text-[10px] py-6">هنوز هیچ گیفی اضافه نشده است.</div>
                      ) : (
                        sharedGifs.map((gif) => (
                          <div
                            key={gif.id}
                            onClick={() => handleSelectGif(gif.url)}
                            className="relative group aspect-video rounded-xl overflow-hidden border border-zinc-900 bg-zinc-900/60 hover:border-amber-500/60 cursor-pointer shadow hover:shadow-amber-950/20 transition-all flex flex-col justify-end"
                          >
                            <img
                              src={gif.url}
                              alt={gif.name}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            {/* Hover info overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-100 flex flex-col justify-end p-1">
                              <span className="text-[9px] font-bold text-zinc-300 truncate">{gif.name}</span>
                            </div>

                            {/* Delete button (owner or admin) */}
                            {(gif.addedBy === currentUser.username || currentUser.role === "admin") && (
                              deletingGifId === gif.id ? (
                                <div 
                                  onClick={(e) => e.stopPropagation()} 
                                  className="absolute top-1 left-1 flex items-center gap-1 bg-black/95 px-1 py-0.5 rounded-md border border-rose-900/50 z-20"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      handleDeleteGif(e, gif.id);
                                      setDeletingGifId(null);
                                    }}
                                    className="bg-rose-950 text-rose-400 px-1 py-0.5 rounded text-[8px] hover:bg-rose-900 cursor-pointer"
                                  >
                                    آره
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingGifId(null);
                                    }}
                                    className="bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded text-[8px] hover:bg-zinc-700 cursor-pointer"
                                  >
                                    نه
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingGifId(gif.id);
                                  }}
                                  className="absolute top-1 left-1 p-1 rounded-md bg-black/70 hover:bg-rose-900 text-zinc-400 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                  title="حذف گیف"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom input area */}
          <div className="bg-zinc-950 border-t border-zinc-900/80 p-3 md:p-4 shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
              
              {/* Send trigger */}
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow active:scale-95 shrink-0"
              >
                <Send className="w-4 h-4 scale-x-[-1]" />
              </button>

              {/* Message field */}
              <input
                type="text"
                placeholder="پیامی بنویسید..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white text-right focus:outline-none focus:border-indigo-600"
              />

              {/* GIF Picker Toggle Button */}
              <button
                type="button"
                onClick={() => setShowGifPanel(!showGifPanel)}
                className={`px-3 py-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow active:scale-95 shrink-0 font-bold ${
                  showGifPanel 
                    ? "bg-amber-600 border-amber-500 text-white" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
                title="گیف‌ها"
              >
                <span className="text-[10px] tracking-wide font-black">GIF</span>
              </button>

            </form>
          </div>

        </div>

      </div>

    </div>

    {/* Mobile Overlay Modal for Sokhan Bozorgan */}
    <AnimatePresence>
      {showQuotesMobile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-zinc-950 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-zinc-900/80 p-6 flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden text-right"
          >
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
              <button
                onClick={() => setShowAddQuote(true)}
                className="text-[11px] bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-500 transition-colors flex items-center gap-1 font-bold"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>افزودن سخن جدید</span>
              </button>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>سخن بزرگان</span>
                <QuoteIcon className="w-4 h-4 text-indigo-400" />
              </h3>
            </div>

            {/* Quote items in mobile overlay */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {quotesLoading ? (
                <p className="text-xs text-zinc-500 text-center py-8">در حال بارگذاری سخنان...</p>
              ) : quotes.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">هیچ سخنی تا کنون ثبت نشده است.</p>
              ) : (
                quotes.map((q) => (
                  <div key={q.id} className="bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-2xl space-y-2 relative group">
                    <p className="text-xs text-zinc-300 leading-relaxed font-serif italic text-right">
                      «{q.text}»
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      {(q.submittedBy === currentUser.username || currentUser.role === "admin") ? (
                        deletingQuoteId === q.id ? (
                          <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-rose-950/40">
                            <span className="text-[8px] text-rose-400">حذف؟</span>
                            <button
                              onClick={() => {
                                handleDeleteQuote(q.id);
                                setDeletingQuoteId(null);
                              }}
                              className="bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded text-[8px] hover:bg-rose-900 cursor-pointer"
                            >
                              بله
                            </button>
                            <button
                              onClick={() => setDeletingQuoteId(null)}
                              className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] hover:bg-zinc-700 cursor-pointer"
                            >
                              خیر
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingQuoteId(q.id)}
                            className="text-rose-400 hover:text-rose-350 cursor-pointer p-1"
                            title="حذف سخن"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : <span />}
                      <span className="font-bold text-indigo-400">— {q.author}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowQuotesMobile(false)}
              className="mt-4 w-full bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-300 py-3 rounded-xl border border-zinc-800 cursor-pointer"
            >
              بستن صفحه
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Form Modal to Add New Quote */}
    <AnimatePresence>
      {showAddQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-950 border border-zinc-900 w-full max-w-sm rounded-3xl p-6 text-right"
          >
            <h3 className="text-sm font-black text-white mb-4 flex items-center justify-end gap-2">
              <span>افزودن سخن گرانبها</span>
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </h3>

            {quoteError && (
              <div className="bg-rose-950/40 border border-rose-900 text-rose-300 text-xs p-3 rounded-xl mb-4 text-center">
                {quoteError}
              </div>
            )}

            <form onSubmit={handleAddQuote} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-400">متن سخن یا نقل‌قول</label>
                <textarea
                  required
                  rows={3}
                  value={newQuoteText}
                  onChange={(e) => setNewQuoteText(e.target.value)}
                  placeholder="مثال: کار بزرگ را کسی انجام می‌دهد که از شکست ترسی ندارد..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-white text-right focus:outline-none focus:border-indigo-600 leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-400">نام گوینده یا نویسنده</label>
                <input
                  type="text"
                  required
                  value={newQuoteAuthor}
                  onChange={(e) => setNewQuoteAuthor(e.target.value)}
                  placeholder="مثال: کوروش بزرگ، ارد بزرگ، شکسپیر"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-white text-right focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddQuote(false);
                    setQuoteError("");
                  }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 py-2.5 rounded-xl border border-zinc-850 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuote}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-xs font-bold text-white py-2.5 rounded-xl cursor-pointer"
                >
                  {isSubmittingQuote ? "در حال ثبت..." : "ثبت سخن"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
