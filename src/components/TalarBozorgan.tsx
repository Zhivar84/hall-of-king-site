import React, { useState, useEffect, useRef } from "react";
import { User, ChatMessage } from "../types";
import { 
  ArrowLeft, Send, Sparkles, Trash2, MessageSquare, Quote, AlertCircle, CornerUpLeft, Image, X, Smile
} from "lucide-react";
import { motion } from "motion/react";

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
  const lastMsgIdRef = useRef<string | null>(null);

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

  // Scroll to bottom of chat only when a genuine new message arrives
  useEffect(() => {
    if (chat.length > 0) {
      const latestMsg = chat[chat.length - 1];
      if (latestMsg.id !== lastMsgIdRef.current) {
        lastMsgIdRef.current = latestMsg.id;
        const container = chatEndRef.current?.parentElement;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        }
      }
    }
  }, [chat]);

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
            // Send the uploaded GIF URL as a message
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
        // Instantly refresh quotes list
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
    <div className="min-h-screen lg:h-[calc(100vh-32px)] bg-black text-[#f3f4f6] font-sans relative lg:overflow-hidden flex flex-col selection:bg-purple-600/30 pt-8 pb-4">
      
      {/* Decorative Background Glows */}
      <div className="absolute top-[-25%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-purple-950/10 blur-[130px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-25%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-zinc-900/10 blur-[130px] animate-pulse pointer-events-none"></div>

      {/* Header */}
      <header className="bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-900/60 relative z-20 px-4 py-4 md:px-8 shadow-md" dir="rtl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>بازگشت به هاب اصلی</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">بخش ویژه سخنان ماندگار و گفتگو</span>
              <h1 className="text-lg font-black text-white flex items-center gap-2 justify-end">
                <span>تالار بزرگان</span>
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
              </h1>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400 shadow-inner">
              <Quote className="w-5 h-5" />
            </div>
          </div>

        </div>
      </header>

      {/* Main Panel layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 md:py-6 flex flex-col lg:flex-row gap-6 lg:overflow-hidden relative z-10" dir="rtl">
        
        {/* Right side: Quotes Registry */}
        <div className="flex-1 lg:w-1/2 flex flex-col space-y-4 lg:overflow-hidden bg-zinc-950/40 border border-zinc-900 rounded-3xl p-4 md:p-6 shadow-2xl">
          
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>ثبت سخنان ماندگار بزرگان</span>
            </h2>
            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-900/40 px-2 py-1 rounded-lg font-mono">
              {quotes.length} سخن ثبت شده
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            سخنان گرانبهای خود یا جملات قصار نویسندگان، شاعران و بزرگان را در این بخش ثبت کنید تا در نوار متحرک بالای تمام تالارهای سایت نمایش داده شود.
          </p>

          {errorMessage && (
            <div className="bg-red-950/40 border border-red-900/50 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form to submit quote */}
          <form onSubmit={handleAddQuote} className="bg-zinc-950/90 border border-purple-950/40 rounded-2xl p-4 space-y-3 shrink-0 shadow-lg">
            <div>
              <label className="block text-[10px] text-zinc-500 font-bold mb-1 mr-1">متن سخن</label>
              <textarea
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="« سخن گرانبها را اینجا بنویسید... »"
                rows={2}
                className="w-full bg-zinc-900/80 border border-zinc-800 text-xs rounded-xl p-3 text-right text-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all resize-none font-medium"
                required
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-zinc-500 font-bold mb-1 mr-1">نام گوینده / نویسنده</label>
                <input
                  type="text"
                  value={quoteAuthor}
                  onChange={(e) => setQuoteAuthor(e.target.value)}
                  placeholder="مثلا: فردوسی"
                  className="w-full bg-zinc-900/80 border border-zinc-800 text-xs rounded-xl p-3 text-right text-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all font-bold"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-6 py-3.5 rounded-xl transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-purple-950/30 flex items-center gap-1.5 h-[46px]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ثبت سخن</span>
                </button>
              </div>
            </div>
          </form>

          {/* List of Quotes */}
          <div className="flex-1 overflow-y-auto max-h-[380px] lg:max-h-[580px] space-y-3.5 pr-1 min-h-[250px]">
            {loading ? (
              <div className="text-center py-12 text-xs text-zinc-500">در حال بارگذاری سخنان...</div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-16 text-xs text-zinc-500 bg-zinc-950/20 border border-zinc-900/40 border-dashed rounded-2xl">
                هنوز هیچ سخنی در این بخش ثبت نشده است. اولین سخن را شما بنویسید!
              </div>
            ) : (
              quotes.map((q) => {
                const isOwner = q.submittedBy === currentUser.username || q.submittedBy === currentUser.nickname || currentUser.role === "admin";
                return (
                  <div
                    key={q.id}
                    className="bg-zinc-950 border border-zinc-900/80 hover:border-purple-900/30 rounded-2xl p-4 space-y-3 relative group transition-all duration-300"
                  >
                    <p className="text-xs text-zinc-100 leading-relaxed font-semibold">« {q.text} »</p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-900/60">
                      <span>نویسنده: <strong className="text-purple-400 font-bold">{q.author}</strong></span>
                      <span className="text-[9px]">فرستنده: {q.submittedBy}</span>
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
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Left side: Chat Room */}
        <div className="flex-1 lg:w-1/2 flex flex-col space-y-4 lg:overflow-hidden bg-zinc-950/40 border border-zinc-900 rounded-3xl p-4 md:p-6 shadow-2xl">
          
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>اتاق گفتگوی بزرگان</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] text-zinc-500">زنده</span>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            در این تالار به بحث، تبادل نظر و گفتگو با سایر بزرگان گروه بپردازید. تمام پیام‌ها به صورت آنلاین و هماهنگ بروزرسانی می‌شوند.
          </p>

          {/* Chat box */}
          <div className="flex-1 bg-black/40 border border-zinc-900/80 rounded-2xl flex flex-col overflow-hidden min-h-[300px]">
            
            {/* Messages container */}
            <div className="flex-1 overflow-y-auto max-h-[380px] lg:max-h-[500px] p-4 space-y-4 relative">
              {loading ? (
                <div className="text-center py-12 text-xs text-zinc-500">در حال دریافت پیام‌ها...</div>
              ) : chat.length === 0 ? (
                <div className="text-center py-16 text-xs text-zinc-500">هیچ پیامی در این تالار ارسال نشده است. اولین پیام را ارسال کنید!</div>
              ) : (
                chat.map((msg) => {
                  const isCurrentUser = msg.username === currentUser.username;
                  const isGif = msg.text.startsWith("http") || msg.text.startsWith("/uploads") || msg.text.includes(".gif");
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col group/msg ${isCurrentUser ? "items-start" : "items-end"}`}
                    >
                      {/* Message header */}
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        {!isCurrentUser && (
                          <button
                            onClick={() => setReplyTo({ id: msg.id, username: msg.username, text: msg.text })}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 bg-zinc-900 hover:bg-zinc-800 text-purple-400 hover:text-purple-300 rounded-lg text-[9px] flex items-center gap-0.5 cursor-pointer"
                            title="پاسخ"
                          >
                            <CornerUpLeft className="w-3 h-3" />
                            <span>پاسخ</span>
                          </button>
                        )}
                        <span className="text-[10px] font-black text-zinc-400">{msg.username}</span>
                        <span className="text-[8px] text-zinc-600">
                          {new Date(msg.createdAt).toLocaleTimeString("fa-IR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isCurrentUser && (
                          <button
                            onClick={() => setReplyTo({ id: msg.id, username: msg.username, text: msg.text })}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 bg-zinc-900 hover:bg-zinc-800 text-purple-400 hover:text-purple-300 rounded-lg text-[9px] flex items-center gap-0.5 cursor-pointer"
                            title="پاسخ"
                          >
                            <span>پاسخ</span>
                            <CornerUpLeft className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Reply Reference Panel */}
                      {msg.replyToText && (
                        <div className="bg-zinc-950/60 border-r-2 border-purple-500 pr-2 pl-1 py-1 rounded-md text-[9px] text-zinc-400 mb-1 leading-normal max-w-[80%] truncate">
                          پاسخ به <strong className="text-purple-400">{msg.replyToUser}</strong>: {msg.replyToText}
                        </div>
                      )}

                      {/* Message body (Image/GIF or Text) */}
                      {isGif ? (
                        <div className="p-1 rounded-2xl bg-zinc-900 border border-zinc-850 overflow-hidden shadow-lg hover:scale-[1.02] transition-transform duration-300">
                          <img
                            src={msg.text}
                            alt="uploaded gif"
                            referrerPolicy="no-referrer"
                            className="rounded-xl max-w-[200px] max-h-[160px] object-cover"
                          />
                        </div>
                      ) : (
                        <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed max-w-[85%] break-words ${
                          isCurrentUser
                            ? "bg-purple-600 text-white rounded-tl-none font-semibold shadow-lg shadow-purple-950/10"
                            : "bg-zinc-900 text-zinc-100 rounded-tr-none border border-zinc-850"
                        }`}>
                          {msg.text}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Uploading GIF status */}
            {uploadingGif && (
              <div className="bg-purple-950/30 border-t border-purple-900/30 text-purple-300 text-[10px] px-4 py-2 flex items-center gap-2 animate-pulse justify-center">
                <Smile className="w-4 h-4 animate-spin" />
                <span>در حال بارگذاری فایل گیف و ارسال...</span>
              </div>
            )}

            {/* Replying To Ribbon Bar */}
            {replyTo && (
              <div className="bg-purple-950/50 border-t border-purple-900/40 px-4 py-2 flex items-center justify-between text-xs text-purple-300 relative z-10">
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

            {/* Chat Input & Accessories form */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-900 relative">
              
              {/* GIF Selector Box Overlay */}
              {gifSelectorOpen && (
                <div className="absolute bottom-[100%] right-3 left-3 bg-zinc-950 border border-zinc-900 rounded-2xl p-3 shadow-2xl space-y-3 z-30 mb-2">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <span className="text-[10px] font-black text-purple-400">انتخاب یا بارگذاری گیف</span>
                    <button
                      onClick={() => setGifSelectorOpen(false)}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset GIFs grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_GIFS.map((g) => (
                      <button
                        key={g.name}
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

                  {/* File upload trigger */}
                  <div className="border-t border-zinc-900 pt-2.5">
                    <label className="flex items-center justify-center gap-2 bg-purple-950/50 hover:bg-purple-900/40 border border-purple-900/30 rounded-xl px-3 py-2 cursor-pointer text-[10px] font-bold text-purple-300 hover:text-white transition-all text-center">
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

              {/* Input Bar */}
              <form onSubmit={(e) => handleSendChat(e)} className="flex gap-2">
                
                {/* GIF Button */}
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

        </div>

      </main>

    </div>
  );
}
