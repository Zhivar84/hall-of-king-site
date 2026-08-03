import React, { useState, useEffect, useRef } from "react";
import { User, TalarBozorgParticipant, ChatMessage } from "../types";
import { 
  ArrowLeft, Mic, MicOff, Video, VideoOff, PhoneOff, Users, 
  Volume2, VolumeX, AlertCircle, RefreshCw, Sparkles, Send, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TalarSokhanProps {
  currentUser: User;
  onBack: () => void;
}

export default function TalarSokhan({ currentUser, onBack }: TalarSokhanProps) {
  const [participants, setParticipants] = useState<TalarBozorgParticipant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Controls
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [isMutedAll, setIsMutedAll] = useState<boolean>(false);

  // Text Chat specifically for Talar Sokhan
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Refs for media
  const localMicStreamRef = useRef<MediaStream | null>(null);
  const localWebcamStreamRef = useRef<MediaStream | null>(null);
  const localVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Polling / Upload intervals
  const webcamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const playedAudioChunksRef = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Join the Talar on mount
  useEffect(() => {
    const joinTalar = async () => {
      try {
        await fetch("/api/talar-bozorg/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: currentUser.username,
            micActive: false,
            webcamActive: false,
            screenActive: false
          })
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to join Talar Sokhan on server:", err);
        setError("خطا در ورود به تالار سخن روی سرور.");
        setLoading(false);
      }
    };

    joinTalar();

    // Leave on unmount
    return () => {
      fetch("/api/talar-bozorg/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username })
      }).catch(e => console.warn(e));

      // Stop all tracks
      if (localMicStreamRef.current) {
        localMicStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (localWebcamStreamRef.current) {
        localWebcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentUser]);

  // Handle local video element binding when camera active
  useEffect(() => {
    if (isWebcamActive && localVideoElementRef.current && localWebcamStreamRef.current) {
      localVideoElementRef.current.srcObject = localWebcamStreamRef.current;
      localVideoElementRef.current.play().catch(e => console.warn("Local video play was interrupted/blocked:", e));
    }
  }, [isWebcamActive, localWebcamStreamRef.current]);

  // Handle updates to server status
  const updateServerStatus = async (mic: boolean, webcam: boolean) => {
    try {
      await fetch("/api/talar-bozorg/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          micActive: mic,
          webcamActive: webcam,
          screenActive: false
        })
      });
    } catch (err) {
      console.warn("Failed to update status on server:", err);
    }
  };

  // Poll participants & audio chunks & Chat
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch participants (includes frames & audio chunks)
        const res = await fetch("/api/talar-bozorg/participants");
        if (res.ok) {
          const data = await res.json();
          const list: TalarBozorgParticipant[] = data.participants || [];
          setParticipants(list);

          // Play incoming audio chunks if not muted and not me
          if (!isMutedAll) {
            list.forEach((p) => {
              if (p.username !== currentUser.username && p.micActive && p.audioChunks) {
                p.audioChunks.forEach((chunk) => {
                  if (!playedAudioChunksRef.current.has(chunk.id)) {
                    playedAudioChunksRef.current.add(chunk.id);
                    // Play chunk
                    try {
                      const audio = new Audio("data:audio/webm;base64," + chunk.data);
                      audio.volume = 1.0;
                      audio.play().catch(e => console.debug("Autoplay audio chunk was blocked/handled:", e));
                    } catch (e) {
                      console.warn("Could not play audio chunk:", e);
                    }
                  }
                });
              }
            });
          }
        }

        // Fetch text chat messages for Talar Sokhan (using type "bozorgan" since it's the group-wide chat)
        const chatRes = await fetch("/api/chat?type=bozorgan");
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setChatMessages(chatData.chat || []);
        }

      } catch (err) {
        console.warn("Error polling Sokhan Hall data:", err);
      }
    };

    fetchData();
    pollIntervalRef.current = setInterval(fetchData, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentUser, isMutedAll]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Handle microphone toggle
  const toggleMicrophone = async () => {
    if (isMicActive) {
      // Turn off mic
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      if (localMicStreamRef.current) {
        localMicStreamRef.current.getTracks().forEach(track => track.stop());
        localMicStreamRef.current = null;
      }
      setIsMicActive(false);
      updateServerStatus(false, isWebcamActive);
    } else {
      // Turn on mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        localMicStreamRef.current = stream;
        setIsMicActive(true);
        updateServerStatus(true, isWebcamActive);

        // Safe browser MIME check to avoid runtime crashes
        let options = {};
        try {
          if (typeof MediaRecorder.isTypeSupported === "function") {
            if (MediaRecorder.isTypeSupported("audio/webm")) {
              options = { mimeType: "audio/webm" };
            } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
              options = { mimeType: "audio/mp4" };
            }
          }
        } catch (e) {
          console.warn("MimeType check not supported/failed:", e);
        }

        // Start media recorder in slices to upload audio chunks
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Data = (reader.result as string).split(",")[1];
              if (base64Data) {
                fetch("/api/talar-bozorg/upload-audio", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: currentUser.username,
                    chunk: {
                      id: "s_" + Math.random().toString(36).substring(2, 11),
                      data: base64Data,
                      timestamp: Date.now()
                    }
                  })
                }).catch(err => console.warn("Failed uploading audio chunk:", err));
              }
            };
            reader.readAsDataURL(e.data);
          }
        };

        // Record in 800ms slices for optimal real-time speech relay
        recorder.start(800);

      } catch (err: any) {
        console.error("Mic access failed:", err);
        alert("دسترسی به میکروفون برقرار نشد. لطفاً مجوز مربوطه را بررسی کنید.");
        setIsMicActive(false);
        updateServerStatus(false, isWebcamActive);
      }
    }
  };

  // Handle webcam toggle
  const toggleWebcam = async () => {
    if (isWebcamActive) {
      // Turn off webcam
      if (localWebcamStreamRef.current) {
        localWebcamStreamRef.current.getTracks().forEach(track => track.stop());
        localWebcamStreamRef.current = null;
      }
      if (webcamIntervalRef.current) {
        clearInterval(webcamIntervalRef.current);
        webcamIntervalRef.current = null;
      }
      setIsWebcamActive(false);
      updateServerStatus(isMicActive, false);

      // Tell server to remove latest frame
      fetch("/api/talar-bozorg/upload-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          webcamFrame: null
        })
      }).catch(e => console.warn(e));

    } else {
      // Turn on webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 }
        });
        localWebcamStreamRef.current = stream;
        setIsWebcamActive(true);
        updateServerStatus(isMicActive, true);

        // Setup interval to capture frames and upload
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 150;
        const ctx = canvas.getContext("2d");

        webcamIntervalRef.current = setInterval(() => {
          if (localVideoElementRef.current && ctx && stream.active) {
            try {
              ctx.drawImage(localVideoElementRef.current, 0, 0, 200, 150);
              const frame = canvas.toDataURL("image/jpeg", 0.45);
              
              fetch("/api/talar-bozorg/upload-frame", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  username: currentUser.username,
                  webcamFrame: frame
                })
              }).catch(e => console.warn("Webcam frame upload error:", e));
            } catch (e) {
              console.warn("Webcam canvas capture error:", e);
            }
          }
        }, 1500);

      } catch (err: any) {
        console.error("Webcam access failed:", err);
        alert("دسترسی به دوربین برقرار نشد. لطفاً مجوز مربوطه را در مرورگر خود تایید کنید.");
        setIsWebcamActive(false);
        updateServerStatus(isMicActive, false);
      }
    }
  };

  // Handle sending chat message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const text = chatInput.trim();
    setChatInput("");

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          text,
          type: "bozorgan"
        })
      });
      // Immediately append message to chat
      const newMsg: ChatMessage = {
        id: "chat_" + Date.now(),
        userId: currentUser.id,
        username: currentUser.username,
        text,
        type: "bozorgan",
        createdAt: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, newMsg]);
    } catch (err) {
      console.warn("Failed to send chat message:", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#f3f4f6] font-sans flex flex-col h-[calc(100vh-32px)] overflow-hidden select-none pt-8">
      
      {/* Header Panel */}
      <div className="bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-900/60 relative z-20 px-4 py-3 md:px-8 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>خروج و بازگشت به هاب</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-sky-950 text-sky-400 border border-sky-900/40 font-mono px-2.5 py-0.5 rounded-full font-bold uppercase">AUDIO & WEBCAM CHAT</span>
            <h1 className="text-base md:text-lg font-black text-white tracking-tight">
              تالار <span className="text-sky-400">سخن</span>
            </h1>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
          <p className="text-xs text-zinc-400">در حال ورود به تالار سخن...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-[#040608]">
          
          {/* Main Speech Room Left panel (Grid of webcams / voice cards) */}
          <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 overflow-y-auto">
            
            {/* Top Controls Bar */}
            <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-right" dir="rtl">
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Microphone Toggle Button */}
                <button
                  onClick={toggleMicrophone}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg border cursor-pointer ${
                    isMicActive 
                      ? "bg-sky-950/80 hover:bg-sky-900 text-sky-400 border-sky-800/40" 
                      : "bg-red-950/60 hover:bg-red-900 text-red-400 border-red-900/45"
                  }`}
                >
                  {isMicActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                  <span>{isMicActive ? "میکروفون: فعال (در حال پخش صدا)" : "میکروفون: قطع صدا"}</span>
                </button>

                {/* Webcam Toggle Button */}
                <button
                  onClick={toggleWebcam}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg border cursor-pointer ${
                    isWebcamActive 
                      ? "bg-purple-950/80 hover:bg-purple-900 text-purple-400 border-purple-800/40" 
                      : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border-zinc-800"
                  }`}
                >
                  {isWebcamActive ? <Video className="w-4 h-4 animate-pulse" /> : <VideoOff className="w-4 h-4" />}
                  <span>{isWebcamActive ? "وب‌کم: روشن" : "وب‌کم: خاموش"}</span>
                </button>

                {/* Mute Others Switch */}
                <button
                  onClick={() => setIsMutedAll(!isMutedAll)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                    isMutedAll 
                      ? "bg-red-950/40 text-red-400 border-red-900/30" 
                      : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-850"
                  }`}
                  title={isMutedAll ? "وصل کردن صدای دیگران" : "قطع کردن صدای همه کاربران"}
                >
                  {isMutedAll ? <VolumeX className="w-4 h-4 text-red-500 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isMutedAll ? "صدای تالار: قطع" : "صدای تالار: وصل"}</span>
                </button>

              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                    <span>گفتگوی صوتی و تصویری گروهی</span>
                    <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
                  </h2>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    صدای شما و وب‌کمتان مستقیم در مرورگر بقیه اعضا پخش می‌شود.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message Box */}
            {error && (
              <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-xl text-xs text-red-400 text-right flex items-center justify-end gap-1.5">
                <span>{error}</span>
                <AlertCircle className="w-4 h-4 shrink-0" />
              </div>
            )}

            {/* Grid of Users Streams */}
            <div className="flex-1 bg-zinc-950/40 border border-zinc-900/80 rounded-3xl p-6 overflow-y-auto min-h-[300px]">
              
              {participants.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center space-y-2 py-12">
                  <Users className="w-12 h-12 text-zinc-800" />
                  <p className="text-xs text-zinc-600 font-bold">هیچ کاربری در تالار سخن حضور ندارد</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  
                  {/* LOCAL USER STREAM PREVIEW */}
                  {isWebcamActive && (
                    <motion.div 
                      layout
                      className="bg-[#0c0f13] border border-sky-900/50 rounded-2xl overflow-hidden p-3 flex flex-col relative aspect-[4/3] group shadow-lg"
                    >
                      <video
                        ref={localVideoElementRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover rounded-xl bg-black transform scale-x-[-1]"
                      />
                      <div className="absolute top-5 right-5 bg-black/75 px-2.5 py-1 rounded-full text-[9px] font-bold text-sky-400 border border-sky-900/30">
                        تصویر شما (وب‌کم)
                      </div>
                      <div className="absolute bottom-5 right-5 left-5 flex items-center justify-between text-[10px]" dir="rtl">
                        <span className="bg-zinc-950/80 text-zinc-300 px-2 py-1 rounded-lg">خودتان</span>
                        <div className="flex items-center gap-1">
                          {isMicActive ? (
                            <span className="w-5 h-5 rounded-full bg-sky-950/80 text-sky-400 flex items-center justify-center border border-sky-900/30"><Mic className="w-3 h-3" /></span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-red-950/80 text-red-400 flex items-center justify-center border border-red-900/30"><MicOff className="w-3 h-3" /></span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* OTHER ACTIVE PARTICIPANTS */}
                  {participants.map((p) => {
                    const isMe = p.username === currentUser.username;
                    if (isMe && isWebcamActive) return null; // Already rendered locally

                    const isWebcamOn = p.webcamActive && p.webcamFrame;
                    const hasSpeechActive = p.micActive;

                    return (
                      <motion.div
                        key={p.username}
                        layout
                        className={`bg-zinc-950/80 rounded-2xl p-4 flex flex-col justify-between relative aspect-[4/3] overflow-hidden border ${
                          hasSpeechActive 
                            ? "border-sky-600/60 shadow-lg shadow-sky-950/20" 
                            : "border-zinc-900"
                        }`}
                      >
                        {/* webcam rendering or placeholder */}
                        {isWebcamOn ? (
                          <div className="w-full h-full relative overflow-hidden rounded-xl bg-black mb-2 flex items-center justify-center">
                            <img
                              src={p.webcamFrame || ""}
                              alt={p.username}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col justify-center items-center rounded-xl bg-zinc-900/35 border border-zinc-900 border-dashed mb-2 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-zinc-950/80 border border-zinc-850 flex items-center justify-center text-zinc-500 font-bold text-sm shadow-md">
                              {p.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[9px] text-zinc-500 font-bold">وب‌کم خاموش است</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px]" dir="rtl">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-white font-bold truncate">@{p.username}</span>
                            {isMe && (
                              <span className="text-[8px] bg-zinc-900 text-zinc-500 border border-zinc-800 px-1 rounded-md">شما</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {p.micActive ? (
                              <span className="w-6 h-6 rounded-full bg-sky-950 text-sky-400 border border-sky-900/30 flex items-center justify-center animate-bounce shadow">
                                <Mic className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-850 flex items-center justify-center">
                                <MicOff className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Speech Ring Glow Indicator */}
                        {hasSpeechActive && (
                          <div className="absolute inset-0 border-2 border-sky-500/30 pointer-events-none rounded-2xl animate-pulse" />
                        )}
                      </motion.div>
                    );
                  })}

                </div>
              )}

            </div>

            {/* Help guidelines */}
            <div className="bg-sky-950/10 border border-sky-900/20 rounded-2xl p-4 flex items-start gap-2.5 text-right" dir="rtl">
              <AlertCircle className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-[11px] font-black text-sky-400">نکته درباره وب‌کم و صدا در تالار سخن</h4>
                <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                  تکنولوژی پخش زنده تالار سخن بر پایه انتقال امن فریم‌های ویدیویی (JPEG) و قطعات صوتی فشرده شده (WebM) روی سرور طراحی شده است. این ساختار بر خلاف پروتکل‌های متداول WebRTC، هرگز با محدودیت‌های پورت یا فایروال‌های سختگیرانه فریم داخلی (Iframe) مرورگر مواجه نمی‌شود و همواره پایداری ۱۰۰ درصدی خواهد داشت!
                </p>
              </div>
            </div>

          </div>

          {/* Right Side panel: Communication Text Chat */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-900 bg-zinc-950/70 flex flex-col justify-between overflow-hidden shrink-0">
            
            <div className="bg-zinc-950 border-b border-zinc-900 p-3.5 flex items-center justify-between text-right shrink-0">
              <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-900/40 font-mono font-bold px-2 py-0.5 rounded-full">TALAR CHAT</span>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>گفتگوی متنی تالار</span>
                <MessageSquare className="w-4 h-4 text-sky-500" />
              </h3>
            </div>

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px] lg:max-h-none relative custom-scrollbar bg-black/15">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-zinc-800" />
                  <p className="text-[10px] text-zinc-600">هنوز گفتگویی شکل نگرفته است.</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.username === currentUser.username;
                  const isSys = msg.username === "سیستم";
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[85%] text-right ${isMe ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                      dir="rtl"
                    >
                      <span className={`text-[9px] font-bold mb-1 px-1 ${isMe ? 'text-sky-400' : isSys ? 'text-red-400' : 'text-zinc-500'}`}>
                        {isMe ? "شما" : `@${msg.username}`}
                      </span>

                      <div className={`p-2.5 rounded-2xl text-xs break-all leading-relaxed shadow-sm ${
                        isMe 
                          ? 'bg-sky-600 text-white rounded-tr-none' 
                          : isSys
                            ? 'bg-red-950/30 border border-red-900/25 text-red-300 text-center rounded-xl w-full'
                            : 'bg-zinc-900 text-zinc-100 border border-zinc-850 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                      
                      <span className="text-[8px] text-zinc-600 mt-1 px-1 font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <div className="bg-zinc-950 border-t border-zinc-900/80 p-3 shrink-0 relative">
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  placeholder="نوشتن پیام در چت تالار سخن..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white text-right focus:outline-none focus:border-sky-600"
                />

                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-md"
                >
                  <Send className="w-3.5 h-3.5 scale-x-[-1]" />
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
