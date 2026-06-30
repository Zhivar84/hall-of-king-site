import React, { useState, useEffect, useRef } from "react";
import { User, ChatMessage, LiveStreamStatus, TalarBozorgParticipant } from "../types";
import { 
  ArrowLeft, Monitor, Play, Square, Tv, Users, Send, MessageCircle, 
  Settings, Volume2, VolumeX, Eye, Radio, Sparkles, RefreshCw, AlertCircle, Maximize2, Minimize2,
  Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare, PlusCircle, UserCheck, ShieldAlert, Copy, Check,
  Trash2, CornerUpLeft, Image as ImageIcon, X, Smile
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Room, RoomEvent, VideoPresets, Track } from "livekit-client";

// Beautiful custom React component to render a LiveKit Track using standard attach/detach APIs
function LiveKitTrackRenderer({ track }: { track: any }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!track) return;
    const element = track.attach();
    element.className = "w-full h-full object-contain rounded-xl bg-black";
    // Check if it already exists to prevent duplicate appending
    if (containerRef.current && !containerRef.current.contains(element)) {
      containerRef.current.appendChild(element);
    }
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track]);

  return <div ref={containerRef} className="w-full h-full relative flex items-center justify-center bg-zinc-950 rounded-xl" />;
}

const PRESET_GIFS = [
  { name: "خنده", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Bkbndub2l6czlyM2UwbHdrdjV4cWJ5MDlzZDJwNjJ6OXFwZnFmOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohhwfWemR7g3AL77G/giphy.gif" },
  { name: "کف زدن", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDVtcHBlZmp0bDVudndnaDlhZmd2MHllZnMwdWZ5ZHcycnMyeG9ldCZlcD12MV_internal_gif_by_id&ct=g/3o7qDQ4kcSD1PLM3BK/giphy.gif" },
  { name: "شگفت‌زده", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1MGdzN2g2dDdsajZldmNmeTB6cjBwbmFsdXN4NG1vZWZ4NHZneCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipOdXMTeQQ4o/giphy.gif" },
  { name: "گریه", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzdzbzBmdnAwZW92dzZkaW1uMHBnZnRxMDhxbnl3dmdtdXUwbms2MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KDRV3Qgh3p0hkAOg6z/giphy.gif" },
  { name: "عالی", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZW1sYzR5dnQ1eThmaTRnbHF3MTQzZmptd21mcnp2bnM5eXg1dnVmbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/t3s3X2bVB8XNm/giphy.gif" },
  { name: "موافقت", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGJmMDhsMXYxOXphY2Y5YmpjdWF5aWJod2ZqMWk5ZmgzdThxbXFwbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppazNM459/giphy.gif" }
];

interface MangaStreamProps {
  currentUser: User;
  onBack: () => void;
}

export default function MangaStream({ currentUser, onBack }: MangaStreamProps) {
  // Hall selection state: 'none', 'koochak'/'koochak2' (YouTube-like stream), 'bozorg' (Discord Stage & Quotes)
  const [selectedHall, setSelectedHall] = useState<'none' | 'koochak' | 'koochak2' | 'bozorg'>('none');

  // --- TALAR BOZORG (DISCORD STAGE & QUOTES CHAT) STATE ---
  const [bozorgParticipants, setBozorgParticipants] = useState<TalarBozorgParticipant[]>([]);
  const [bozorgChat, setBozorgChat] = useState<ChatMessage[]>([]);
  const [bozorgChatInput, setBozorgChatInput] = useState<string>("");
  const [bozorgQuotes, setBozorgQuotes] = useState<any[]>([]);
  const [newQuoteText, setNewQuoteText] = useState<string>("");
  const [newQuoteAuthor, setNewQuoteAuthor] = useState<string>("");
  const [isBozorgJoined, setIsBozorgJoined] = useState<boolean>(false);
  const [bozorgMicActive, setBozorgMicActive] = useState<boolean>(false);
  const [bozorgWebcamActive, setBozorgWebcamActive] = useState<boolean>(false);
  const [bozorgScreenActive, setBozorgScreenActive] = useState<boolean>(false);
  const [bozorgLoading, setBozorgLoading] = useState<boolean>(true);
  const [bozorgError, setBozorgError] = useState<string>("");
  const [bozorgActiveTab, setBozorgActiveTab] = useState<'chat' | 'quotes'>('quotes');

  const bozorgWebcamStreamRef = useRef<MediaStream | null>(null);
  const bozorgWebcamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bozorgScreenStreamRef = useRef<MediaStream | null>(null);
  const bozorgScreenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bozorgChatEndRef = useRef<HTMLDivElement>(null);

  // --- LIVEKIT (SFU) STREAMING STATE ---
  const [livekitConfig, setLivekitConfig] = useState<{ isConfigured: boolean; url: string } | null>(null);
  const [livekitVideoTrack, setLivekitVideoTrack] = useState<any | null>(null);
  const livekitRoomRef = useRef<Room | null>(null);

  // --- TALAR KOOCHAK (YOUTUBE) STATE ---
  const [streamStatus, setStreamStatus] = useState<LiveStreamStatus & { quality?: string }>({
    isLive: false,
    streamer: "",
    title: "",
    streamType: "webcam",
  });
  const [koochakChat, setKoochakChat] = useState<ChatMessage[]>([]);
  const [koochakInput, setKoochakInput] = useState<string>("");
  const [koochakLoading, setKoochakLoading] = useState<boolean>(true);

  // Koochak Reply & GIF states
  const [koochakReplyTo, setKoochakReplyTo] = useState<{ id: string; username: string; text: string } | null>(null);
  const [koochakGifSelectorOpen, setKoochakGifSelectorOpen] = useState<boolean>(false);
  const [koochakUploadingGif, setKoochakUploadingGif] = useState<boolean>(false);
  const [isStreamZoomed, setIsStreamZoomed] = useState<boolean>(false);
  const [isStreamFullscreen, setIsStreamFullscreen] = useState<boolean>(false);
  const livePlayerContainerRef = useRef<HTMLDivElement>(null);
  const lastKoochakMsgIdRef = useRef<string | null>(null);

  const toggleFullscreen = () => {
    if (!livePlayerContainerRef.current) return;
    const nextFullscreen = !isStreamFullscreen;
    setIsStreamFullscreen(nextFullscreen);

    if (nextFullscreen) {
      if (livePlayerContainerRef.current.requestFullscreen) {
        livePlayerContainerRef.current.requestFullscreen().catch((err) => {
          console.log("Browser fullscreen blocked/not supported, relying on virtual full screen:", err);
        });
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.log("Error exiting browser fullscreen:", err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsStreamFullscreen(isNowFullscreen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);
  
  // Custom video streaming controls
  const [streamQuality, setStreamQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const streamQualityRef = useRef(streamQuality);
  useEffect(() => {
    streamQualityRef.current = streamQuality;
  }, [streamQuality]);

  const handleQualityChange = async (quality: 'low' | 'medium' | 'high') => {
    setStreamQuality(quality);
    if (isLocalSharing) {
      try {
        await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isLive: true,
            streamer: currentUser.username,
            title: streamTitleInput.trim() || (streamSource === "webcam" ? `پخش زنده وب‌کم ${currentUser.username}` : `پخش زنده صفحه نمایش ${currentUser.username}`),
            streamType: streamSource,
            quality: quality
          })
        });
      } catch (err) {
        console.warn("Could not update livestream quality on server:", err);
      }
    }
  };

  const [isLocalSharing, setIsLocalSharing] = useState<boolean>(false);
  const [streamTitleInput, setStreamTitleInput] = useState<string>("");
  const [streamSource, setStreamSource] = useState<'screen' | 'webcam'>('screen');
  const [localStreamObject, setLocalStreamObject] = useState<MediaStream | null>(null);
  const [showGoLiveModal, setShowGoLiveModal] = useState<boolean>(false);
  const [koochakError, setKoochakError] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Media references
  const koochakVideoRef = useRef<HTMLVideoElement>(null);
  const koochakMediaStreamRef = useRef<MediaStream | null>(null);
  const koochakChatEndRef = useRef<HTMLDivElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    fetch("/api/livekit/config")
      .then(res => res.json())
      .then(data => {
        setLivekitConfig(data);
      })
      .catch(err => {
        console.warn("Error fetching LiveKit config:", err);
        setLivekitConfig({ isConfigured: false, url: "" });
      });
  }, []);

  // --- MAIN TALAR POLLERS & LOGIC ---

  // Talar Koochak (YouTube style) loading & polling
  const loadKoochakData = async () => {
    try {
      const streamRes = await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream");
      if (streamRes.ok) {
        const status = await streamRes.json();
        setStreamStatus(status);
      }
      
      const chatRes = await fetch(selectedHall === 'koochak2' ? "/api/chat?type=stream2" : "/api/chat?type=stream");
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setKoochakChat(chatData.chat || []);
      }
    } catch (err) {
      console.warn("Could not load stream status:", err);
    } finally {
      setKoochakLoading(false);
    }
  };

  // Manage room switching
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Disconnect previous LiveKit room if any
    if (livekitRoomRef.current) {
      console.log("Disconnecting from previous LiveKit room...");
      livekitRoomRef.current.disconnect();
      livekitRoomRef.current = null;
    }
    setLivekitVideoTrack(null);

    if (selectedHall === 'koochak' || selectedHall === 'koochak2') {
      loadKoochakData();
      interval = setInterval(loadKoochakData, 3000);
      
      if (livekitConfig?.isConfigured) {
        // Connect to LiveKit Room
        const initLiveKit = async () => {
          try {
            const roomName = selectedHall === 'koochak2' ? 'koochak2' : 'koochak';
            const response = await fetch(`/api/livekit/token?room=${roomName}&identity=${currentUser.username}`);
            if (!response.ok) return;
            const { token, serverUrl } = await response.json();
            
            // Fire-wall optimized configurations for secure grey-cloud transport tunnels (Iran Infrastructure)
            const room = new Room({
              adaptiveStream: true,
              dynacast: true,
              publishDefaults: {
                simulcast: true,
                dtx: true,
              }
            });
            livekitRoomRef.current = room;

            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
              if (track.kind === "video") {
                setLivekitVideoTrack(track);
              } else if (track.kind === "audio") {
                const element = track.attach();
                element.id = `livekit-audio-${participant.sid}-${track.sid}`;
                document.body.appendChild(element);
                // Auto-play immediately on attachment to bypass browser constraints
                element.play().catch(e => console.warn("Autoplay muted/blocked:", e));
              }
            });

            room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
              if (track.kind === "video") {
                setLivekitVideoTrack(null);
              } else if (track.kind === "audio") {
                const element = document.getElementById(`livekit-audio-${participant.sid}-${track.sid}`);
                if (element) {
                  element.remove();
                }
                track.detach();
              }
            });

            // Optimize rtcConfig with large ICE candidate pool size to gather TURN TCP/TLS candidates rapidly over HTTPS/WSS
            await room.connect(serverUrl || livekitConfig.url, token, {
              autoSubscribe: true,
              rtcConfig: {
                iceCandidatePoolSize: 8,
              }
            });
            console.log(`Connected to LiveKit SFU room: ${roomName}`);
          } catch (err) {
            console.warn("LiveKit connection failed:", err);
          }
        };
        initLiveKit();
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedHall, livekitConfig]);

  // Clean up all streams and recording intervals on unmount
  useEffect(() => {
    return () => {
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
      if (koochakMediaStreamRef.current) {
        koochakMediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Scroll chat only when a genuine new message arrives
  useEffect(() => {
    if (koochakChat.length > 0) {
      const latestMsg = koochakChat[koochakChat.length - 1];
      if (latestMsg.id !== lastKoochakMsgIdRef.current) {
        lastKoochakMsgIdRef.current = latestMsg.id;
        const container = koochakChatEndRef.current?.parentElement;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        }
      }
    }
  }, [koochakChat, selectedHall]);
  const startKoochakStream = async () => {
    setKoochakError("");
    const titleToUse = streamTitleInput.trim() || 
      (streamSource === "webcam" 
        ? `پخش زنده وب‌کم ${currentUser.username}` 
        : `پخش زنده صفحه نمایش ${currentUser.username}`);
    
    try {
      let stream: MediaStream;
      if (streamSource === "webcam") {
        // Capture Webcam with optimized HD capabilities and default fallbacks
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280, max: 1920 }, 
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 60 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (e) {
          console.warn("Retrying with fallback simpler constraints due to:", e);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e2) {
            console.warn("Retrying video-only fallback due to:", e2);
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      } else {
        // Capture Desktop screen
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 30, max: 60 }
            },
            audio: true
          });
        } catch (e) {
          console.warn("Retrying with fallback simpler display constraints due to:", e);
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          } catch (e2) {
            throw e2;
          }
        }
      }
      
      koochakMediaStreamRef.current = stream;
      setLocalStreamObject(stream);

      // Handle user stopping screen share from browser overlay
      stream.getVideoTracks()[0].onended = () => {
        stopKoochakStream();
      };

      setIsLocalSharing(true);
      setShowGoLiveModal(false);

      if (!livekitConfig?.isConfigured) {
        setKoochakError("پیکربندی لایوکیت در سرور فعال نیست. لطفاً متغیرهای محیطی لایوکیت را روی سرور بررسی و تنظیم کنید.");
        stopKoochakStream();
        return;
      }

      if (livekitRoomRef.current) {
        const room = livekitRoomRef.current;
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        if (videoTrack) {
          await room.localParticipant.publishTrack(videoTrack, {
            name: streamSource === "webcam" ? "camera" : "screen_share",
          });
        }
        if (audioTrack) {
          // Force microphone track activation to bypass strict browser mute and autoplay policies
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            console.log("Forced microphone track activation via setMicrophoneEnabled");
          } catch (micErr) {
            console.warn("setMicrophoneEnabled failed, publishing track manually:", micErr);
            await room.localParticipant.publishTrack(audioTrack, {
              name: "microphone",
            });
          }
        }
      }

      // Register live stream on server
      await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isLive: true,
          streamer: currentUser.username,
          title: titleToUse,
          streamType: streamSource,
          streamUrl: "",
          quality: streamQuality
        })
      });

      // Send a system chat message to announce stream
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "system",
          username: "سیستم",
          text: `📢 ${currentUser.username} پخش زنده جدیدی را در ${
            selectedHall === 'koochak2' ? 'تالار کوچک ۲' : 'تالار کوچک ۱'
          } با کیفیت ${
            streamQuality === 'high' ? 'بالا (1080p)' : streamQuality === 'low' ? 'کاهش‌یافته (360p)' : 'متوسط (720p)'
          } با عنوان «${titleToUse}» آغاز کرد!`,
          type: selectedHall === 'koochak2' ? "stream2" : "stream"
        })
      });

      loadKoochakData();

    } catch (err: any) {
      console.warn("Capture screen/webcam failed gracefully caught:", err);
      let friendlyError = "خطای ناشناخته در دسترسی به رسانه.";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        if (streamSource === "screen") {
          friendlyError = "اجازه دسترسی به صفحه نمایش صادر نشد. به دلیل قوانین امنیتی شدید مرورگرها در بستر iframe (مثلاً در محیط توسعه AI Studio)، لطفاً حتماً روی دکمه باز کردن در تب جدید (کوچک بالا سمت راست) کلیک کنید تا برنامه در یک تب مستقل باز شود، سپس به راحتی استریم صفحه نمایش را شروع کنید.";
        } else {
          friendlyError = "مجوز دسترسی به دوربین یا میکروفون توسط کاربر یا سیستم‌عامل رد شده است. لطفاً آیکون قفل کنار آدرس‌بار مرورگر را باز کرده و مجوز دوربین/میکروفون را برای این سایت به Allow تغییر دهید.";
        }
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        friendlyError = streamSource === "screen" 
          ? "منبع معتبری برای اشتراک‌گذاری صفحه نمایش یافت نشد."
          : "هیچ دوربین، وب‌کم یا میکروفون فعالی روی سیستم شما پیدا نشد. لطفاً سخت‌افزار خود را بررسی کنید.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        friendlyError = "دوربین، وب‌کم یا میکروفون شما توسط برنامه دیگری (مانند تلگرام، دیسکورد یا زوم) قفل شده است. لطفاً آن برنامه‌ها را ببندید و مجدداً تلاش کنید.";
      } else if (err.name === "SecurityError") {
        friendlyError = "مرورگر به دلایل امنیتی دسترسی به صفحه نمایش درون یک فریم داخلی (iframe) را مسدود کرده است. حتماً روی دکمه باز کردن در تب جدید کلیک کنید و استریم را در تب مستقل آغاز نمایید.";
      } else {
        friendlyError = `خطا در دریافت جریان رسانه: ${err.message || err.name || "خطای ناشناخته"}`;
      }
      
      setKoochakError(friendlyError);
    }
  };

  const stopKoochakStream = async () => {
    if (koochakMediaStreamRef.current) {
      koochakMediaStreamRef.current.getTracks().forEach(t => t.stop());
      koochakMediaStreamRef.current = null;
    }
    setLocalStreamObject(null);
    if (koochakVideoRef.current) {
      koochakVideoRef.current.srcObject = null;
    }
    if (hiddenVideoRef.current) {
      if (hiddenVideoRef.current.parentNode) {
        hiddenVideoRef.current.parentNode.removeChild(hiddenVideoRef.current);
      }
      hiddenVideoRef.current = null;
    }
    setIsLocalSharing(false);

    if (livekitConfig?.isConfigured) {
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
      setLivekitVideoTrack(null);
      // Re-join the room as a viewer after a small delay
      setTimeout(() => {
        if (selectedHall === 'koochak' || selectedHall === 'koochak2') {
          const roomName = selectedHall === 'koochak2' ? 'koochak2' : 'koochak';
          fetch(`/api/livekit/token?room=${roomName}&identity=${currentUser.username}`)
            .then(res => res.json())
            .then(async ({ token, serverUrl }) => {
              const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                publishDefaults: {
                  simulcast: true,
                  dtx: true,
                }
              });
              livekitRoomRef.current = room;
              room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === "video") {
                  setLivekitVideoTrack(track);
                } else if (track.kind === "audio") {
                  const element = track.attach();
                  element.id = `livekit-audio-${participant.sid}-${track.sid}`;
                  document.body.appendChild(element);
                  // Auto-play immediately on attachment to bypass browser constraints
                  element.play().catch(e => console.warn("Autoplay muted/blocked:", e));
                }
              });
              room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                if (track.kind === "video") {
                  setLivekitVideoTrack(null);
                } else if (track.kind === "audio") {
                  const element = document.getElementById(`livekit-audio-${participant.sid}-${track.sid}`);
                  if (element) {
                    element.remove();
                  }
                  track.detach();
                }
              });
              await room.connect(serverUrl || livekitConfig.url, token, {
                autoSubscribe: true,
                rtcConfig: {
                  iceCandidatePoolSize: 8,
                }
              });
            }).catch(e => console.warn("Re-joining room failed:", e));
        }
      }, 1000);
    }

    try {
      await fetch(selectedHall === 'koochak2' ? "/api/livestream2" : "/api/livestream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLive: false })
      });

      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "system",
          username: "سیستم",
          text: `🛑 پخش زنده ${currentUser.username} به پایان رسید.`,
          type: selectedHall === 'koochak2' ? "stream2" : "stream"
        })
      });
      loadKoochakData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendKoochakChat = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : koochakInput.trim();
    if (!textToSend) return;

    if (customText === undefined) {
      setKoochakInput("");
    }

    const payload: any = {
      userId: currentUser.id,
      username: currentUser.username,
      text: textToSend,
      type: selectedHall === 'koochak2' ? "stream2" : "stream"
    };

    if (koochakReplyTo) {
      payload.replyToId = koochakReplyTo.id;
      payload.replyToUser = koochakReplyTo.username;
      payload.replyToText = koochakReplyTo.text;
      setKoochakReplyTo(null);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newMsg = await res.json();
        setKoochakChat(prev => [...prev, newMsg]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKoochakGifUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "image/gif") {
      alert("لطفاً فقط فایل با پسوند GIF آپلود کنید.");
      return;
    }

    setKoochakUploadingGif(true);
    setKoochakGifSelectorOpen(false);

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
            handleSendKoochakChat(undefined, data.url);
          }
        } else {
          alert("آپلود گیف با خطا مواجه شد.");
        }
        setKoochakUploadingGif(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to upload GIF file:", err);
      setKoochakUploadingGif(false);
    }
  };

  // --- TALAR BOZORG CONTROLLER ACTIONS & POLLING ---

  const loadBozorgData = async () => {
    try {
      // 1. Fetch participants
      const partRes = await fetch("/api/talar-bozorg/participants");
      if (partRes.ok) {
        const data = await partRes.json();
        setBozorgParticipants(data.participants || []);
      }
      
      // 2. Fetch chat
      const chatRes = await fetch("/api/chat?type=bozorgan");
      if (chatRes.ok) {
        const data = await chatRes.json();
        setBozorgChat(data.chat || []);
      }

      // 3. Fetch quotes
      const quotesRes = await fetch("/api/quotes");
      if (quotesRes.ok) {
        const data = await quotesRes.json();
        setBozorgQuotes(data.quotes || []);
      }
    } catch (err) {
      console.warn("Error loading Talar Bozorg data:", err);
    } finally {
      setBozorgLoading(false);
    }
  };

  // Manage join, leave and polling
  useEffect(() => {
    if (selectedHall !== 'bozorg') return;

    setBozorgLoading(true);
    setBozorgError("");
    loadBozorgData();
    const interval = setInterval(loadBozorgData, 1500);

    // Auto join on entry
    fetch("/api/talar-bozorg/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUser.username,
        micActive: bozorgMicActive,
        webcamActive: bozorgWebcamActive,
        screenActive: bozorgScreenActive
      })
    }).then(() => {
      setIsBozorgJoined(true);
    }).catch(e => console.warn("Failed to join Talar Bozorg", e));

    return () => {
      clearInterval(interval);
      // Leave on exit
      fetch("/api/talar-bozorg/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username })
      }).catch(e => console.warn("Failed to leave Talar Bozorg", e));
      setIsBozorgJoined(false);
      
      // Stop webcam
      if (bozorgWebcamStreamRef.current) {
        bozorgWebcamStreamRef.current.getTracks().forEach(track => track.stop());
        bozorgWebcamStreamRef.current = null;
      }
      if (bozorgWebcamIntervalRef.current) {
        clearInterval(bozorgWebcamIntervalRef.current);
        bozorgWebcamIntervalRef.current = null;
      }

      // Stop screen
      if (bozorgScreenStreamRef.current) {
        bozorgScreenStreamRef.current.getTracks().forEach(track => track.stop());
        bozorgScreenStreamRef.current = null;
      }
      if (bozorgScreenIntervalRef.current) {
        clearInterval(bozorgScreenIntervalRef.current);
        bozorgScreenIntervalRef.current = null;
      }
    };
  }, [selectedHall]);

  // Status changes
  const handleUpdateBozorgStatus = async (mic: boolean, webcam: boolean, screen: boolean) => {
    setBozorgMicActive(mic);
    setBozorgWebcamActive(webcam);
    setBozorgScreenActive(screen);

    try {
      await fetch("/api/talar-bozorg/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          micActive: mic,
          webcamActive: webcam,
          screenActive: screen
        })
      });
    } catch (err) {
      console.warn("Failed to update status on server:", err);
    }
  };

  // Web camera capture & upload effect
  useEffect(() => {
    if (selectedHall === 'bozorg' && bozorgWebcamActive && isBozorgJoined) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then(stream => {
          bozorgWebcamStreamRef.current = stream;
          
          const webcamVideo = document.createElement("video");
          webcamVideo.srcObject = stream;
          webcamVideo.play().catch(e => console.warn(e));

          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext("2d");

          bozorgWebcamIntervalRef.current = setInterval(() => {
            if (webcamVideo && ctx && stream.active) {
              try {
                ctx.drawImage(webcamVideo, 0, 0, 320, 240);
                const frame = canvas.toDataURL("image/jpeg", 0.5);
                
                fetch("/api/talar-bozorg/upload-frame", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: currentUser.username,
                    webcamFrame: frame
                  })
                }).catch(e => console.warn("Frame upload error:", e));
              } catch (e) {
                console.warn("Canvas capture error:", e);
              }
            }
          }, 1500);
        })
        .catch(err => {
          console.warn("Failed to get camera for Talar Bozorg:", err);
          setBozorgError("دسترسی به دوربین برقرار نشد.");
          setBozorgWebcamActive(false);
          handleUpdateBozorgStatus(bozorgMicActive, false, bozorgScreenActive);
        });
    } else {
      if (bozorgWebcamStreamRef.current) {
        bozorgWebcamStreamRef.current.getTracks().forEach(track => track.stop());
        bozorgWebcamStreamRef.current = null;
      }
      if (bozorgWebcamIntervalRef.current) {
        clearInterval(bozorgWebcamIntervalRef.current);
        bozorgWebcamIntervalRef.current = null;
      }
      if (selectedHall === 'bozorg' && isBozorgJoined) {
        fetch("/api/talar-bozorg/upload-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: currentUser.username,
            webcamFrame: null
          })
        }).catch(e => console.warn(e));
      }
    }

    return () => {
      if (bozorgWebcamStreamRef.current) {
        bozorgWebcamStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (bozorgWebcamIntervalRef.current) {
        clearInterval(bozorgWebcamIntervalRef.current);
      }
    };
  }, [bozorgWebcamActive, isBozorgJoined, selectedHall]);

  // Screen share capture & upload effect
  useEffect(() => {
    if (selectedHall === 'bozorg' && bozorgScreenActive && isBozorgJoined) {
      navigator.mediaDevices.getDisplayMedia({ video: { width: 640, height: 480 } })
        .then(stream => {
          bozorgScreenStreamRef.current = stream;
          
          stream.getVideoTracks()[0].onended = () => {
            setBozorgScreenActive(false);
            handleUpdateBozorgStatus(bozorgMicActive, bozorgWebcamActive, false);
          };

          const screenVideo = document.createElement("video");
          screenVideo.srcObject = stream;
          screenVideo.play().catch(e => console.warn(e));

          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d");

          bozorgScreenIntervalRef.current = setInterval(() => {
            if (screenVideo && ctx && stream.active) {
              try {
                ctx.drawImage(screenVideo, 0, 0, 640, 480);
                const frame = canvas.toDataURL("image/jpeg", 0.4);
                
                fetch("/api/talar-bozorg/upload-frame", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: currentUser.username,
                    screenFrame: frame
                  })
                }).catch(e => console.warn("Screen frame upload error:", e));
              } catch (e) {
                console.warn("Screen capture error:", e);
              }
            }
          }, 2000);
        })
        .catch(err => {
          console.warn("Failed to display screen capture:", err);
          setBozorgScreenActive(false);
          handleUpdateBozorgStatus(bozorgMicActive, bozorgWebcamActive, false);
        });
    } else {
      if (bozorgScreenStreamRef.current) {
        bozorgScreenStreamRef.current.getTracks().forEach(track => track.stop());
        bozorgScreenStreamRef.current = null;
      }
      if (bozorgScreenIntervalRef.current) {
        clearInterval(bozorgScreenIntervalRef.current);
        bozorgScreenIntervalRef.current = null;
      }
      if (selectedHall === 'bozorg' && isBozorgJoined) {
        fetch("/api/talar-bozorg/upload-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: currentUser.username,
            screenFrame: null
          })
        }).catch(e => console.warn(e));
      }
    }

    return () => {
      if (bozorgScreenStreamRef.current) {
        bozorgScreenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (bozorgScreenIntervalRef.current) {
        clearInterval(bozorgScreenIntervalRef.current);
      }
    };
  }, [bozorgScreenActive, isBozorgJoined, selectedHall]);

  // Scroll bozorg chat
  useEffect(() => {
    if (selectedHall === 'bozorg') {
      const container = bozorgChatEndRef.current?.parentElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }
    }
  }, [bozorgChat, selectedHall, bozorgActiveTab]);

  const handleSendBozorgChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bozorgChatInput.trim()) return;

    const text = bozorgChatInput.trim();
    setBozorgChatInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          text,
          type: "bozorgan"
        })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setBozorgChat(prev => [...prev, newMsg]);
      }
    } catch (err) {
      console.warn("Failed to send bozorg chat:", err);
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim() || !newQuoteAuthor.trim()) return;

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newQuoteText.trim(),
          author: newQuoteAuthor.trim(),
          submittedBy: currentUser.nickname || currentUser.username
        })
      });
      if (res.ok) {
        setNewQuoteText("");
        setNewQuoteAuthor("");
        // Reload quotes
        const quotesRes = await fetch("/api/quotes");
        if (quotesRes.ok) {
          const data = await quotesRes.json();
          setBozorgQuotes(data.quotes || []);
        }
      }
    } catch (err) {
      console.warn("Failed to add quote:", err);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setBozorgQuotes(prev => prev.filter(q => q.id !== id));
      }
    } catch (err) {
      console.warn("Failed to delete quote:", err);
    }
  };


  const getInitials = (name: string) => {
    return name ? name.substring(0, 2).toUpperCase() : "کاربر";
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // --- RENDERING VIEWS ---

  return (
    <div className="min-h-screen bg-black text-[#f3f4f6] font-sans flex flex-col h-[calc(100vh-32px)] overflow-hidden select-none pt-8">
      
      {/* Dynamic Navigation Header */}
      <div className="bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-900/60 relative z-20 px-4 py-3 md:px-8 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>بازگشت به هاب اصلی</span>
            </button>
            {selectedHall !== 'none' && (
              <button
                onClick={() => setSelectedHall('none')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold"
              >
                <span>تغییر تالار نمایش</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedHall === 'bozorg' ? (
              <span className="text-xs bg-purple-950 text-purple-400 border border-purple-900/40 font-mono px-2 py-0.5 rounded font-bold uppercase">DISCORD STAGE</span>
            ) : selectedHall === 'koochak' || selectedHall === 'koochak2' ? (
              <span className="text-xs bg-rose-950 text-rose-400 border border-rose-900/40 font-mono px-2 py-0.5 rounded font-bold uppercase">SERVER RELAY LIVE</span>
            ) : (
              <span className="text-xs bg-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded border border-zinc-700/50 font-bold uppercase">TALAR ROOM</span>
            )}
            <h1 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-1">
              {selectedHall === 'bozorg' ? (
                <>تالار <span className="text-purple-400">بزرگ (دیسکوردی)</span></>
              ) : selectedHall === 'koochak' ? (
                <>تالار <span className="text-red-400">کوچک ۱ (یوتیوبی)</span></>
              ) : selectedHall === 'koochak2' ? (
                <>تالار <span className="text-red-400">کوچک ۲ (یوتیوبی)</span></>
              ) : (
                <>تالار <span className="text-amber-500">نمایش</span></>
              )}
            </h1>
          </div>
        </div>
      </div>

      {/* VIEW: HALL CHOOSE MENU */}
      {selectedHall === 'none' && (
        <div className="flex-1 overflow-y-auto flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-b from-zinc-950 to-black">
          <div className="max-w-4xl w-full text-center space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-white">به تالار نمایش خوش آمدید</h2>
              <p className="text-xs md:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
                تالار مورد نظر خود را انتخاب کنید. همه‌چیز مستقیم از طریق مرورگر شما روی سرور پخش می‌شود:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-w-3xl mx-auto">
              
              {/* Talar Koochak Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-gradient-to-br from-zinc-950 to-rose-950/20 border border-rose-900/30 rounded-3xl p-6 text-right flex flex-col justify-between space-y-6 relative overflow-hidden group shadow-xl"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-2xl group-hover:bg-rose-600/20 transition-all duration-500"></div>

                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-800/40 flex items-center justify-center text-rose-400 shadow-inner">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold text-white flex items-center justify-end gap-2">
                      <span className="text-xs bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded-md border border-rose-800/30">آپلود سرور و پخش همزمان</span>
                      <span>تالار کوچک ۱ (یوتیوبی)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      لایو استریم سنتی مانند یوتیوب با سیستم صوتی همگام‌سازی شده. یک نفر پخش صفحه یا وب‌کم و صدای خود را با کیفیت دلخواه آغاز کرده و سرور آن را بین تماشاگران پخش می‌کند.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">تنظیم کیفیت (360p, 720p, 1080p)</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">همگام‌سازی صوتی پیشرفته</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">انتقال بدون P2P (رله کامل سروری)</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHall('koochak')}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-rose-950/50"
                >
                  ورود به تالار کوچک ۱ استریمی
                </button>
              </motion.div>

              {/* Talar Koochak 2 Card */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="bg-gradient-to-br from-zinc-950 to-rose-950/20 border border-rose-900/30 rounded-3xl p-6 text-right flex flex-col justify-between space-y-6 relative overflow-hidden group shadow-xl"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-2xl group-hover:bg-rose-600/20 transition-all duration-500"></div>

                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-800/40 flex items-center justify-center text-rose-400 shadow-inner">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-extrabold text-white flex items-center justify-end gap-2">
                      <span className="text-xs bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded-md border border-rose-800/30">اتاق دوم پخش همزمان</span>
                      <span>تالار کوچک ۲ (یوتیوبی)</span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      دومین اتاق مستقل پخش سنتی با سیستم صوتی همگام‌سازی شده. مناسب برای پخش موازی دیگر یا زمانی که تالار کوچک اول در حال استفاده و شلوغ است.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">تنظیم کیفیت (360p, 720p, 1080p)</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">کانال مستقل صوتی سروری</span>
                    <span className="text-[10px] bg-zinc-900 border border-rose-950/40 text-rose-300 px-2 py-1 rounded-lg">انتقال بدون P2P (رله کامل سروری)</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHall('koochak2')}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-rose-950/50"
                >
                  ورود به تالار کوچک ۲ استریمی
                </button>
              </motion.div>

            </div>
          </div>
        </div>
      )}


      {/* VIEW: TALAR KOOCHAK (YOUTUBE LIVE STREAM STYLE) */}
      {(selectedHall === 'koochak' || selectedHall === 'koochak2') && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-[#060408]">
          
          {/* Stream & Player side (Left) */}
          <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 overflow-y-auto">
            
            {/* Top stream state panel */}
            <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-right" dir="rtl">
              
              <div className="flex items-center gap-2">
                {isLocalSharing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={stopKoochakStream}
                      className="flex items-center gap-1.5 bg-red-650 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-red-950/30"
                    >
                      <Square className="w-4 h-4" />
                      <span>پایان پخش زنده</span>
                    </button>
                    
                    {/* Live stream dynamic quality settings */}
                    <div className="flex items-center gap-1 bg-[#120f18] border border-zinc-900 p-1 rounded-xl">
                      <span className="text-[10px] text-zinc-400 px-1.5">تغییر کیفیت زنده:</span>
                      <button
                        onClick={() => handleQualityChange('low')}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          streamQuality === 'low'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        ضعیف (360p)
                      </button>
                      <button
                        onClick={() => handleQualityChange('medium')}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          streamQuality === 'medium'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        متوسط (720p)
                      </button>
                      <button
                        onClick={() => handleQualityChange('high')}
                        className={`text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          streamQuality === 'high'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30 font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        عالی (1080p)
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setKoochakError("");
                      setShowGoLiveModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-red-950/25 cursor-pointer"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>شروع پخش صفحه نمایش</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {streamStatus.isLive && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                    <h2 className="text-sm font-bold text-white">
                      {streamStatus.isLive ? streamStatus.title : "هیچ استریمی در جریان نیست"}
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {streamStatus.isLive 
                      ? `در حال پخش زنده توسط: ${streamStatus.streamer} (بدون نیاز به OBS)` 
                      : "تصویر دسکتاپ، یک پنجره یا بازی خود را انتخاب کنید تا با کیفیت دلخواه مستقیم روی سرور فرستاده شود."}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-500 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
              </div>

            </div>

            {koochakError && (
              <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl text-xs text-rose-400 text-right flex items-center justify-end gap-1.5">
                <span>{koochakError}</span>
                <AlertCircle className="w-4 h-4 shrink-0" />
              </div>
            )}

            {/* Live Player Screen */}
            <div 
              ref={livePlayerContainerRef}
              className={`transition-all duration-300 bg-[#09070c] border border-zinc-900 rounded-3xl overflow-hidden relative flex flex-col justify-center items-center shadow-2xl ${
                isStreamFullscreen 
                  ? "fixed inset-0 z-[99999] w-screen h-screen p-4 bg-black rounded-none" 
                  : (isStreamZoomed ? "h-[580px] w-full" : "flex-1 min-h-[320px] w-full")
              }`}
            >
              
              {/* Floating Fullscreen Overlay Button (Directly on Stream Screen) */}
              <button
                onClick={toggleFullscreen}
                className="absolute top-14 left-4 z-50 flex items-center gap-1.5 bg-black/80 hover:bg-black text-white hover:text-red-400 text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-xl border border-zinc-800/80 cursor-pointer shadow-lg transition-all"
                dir="rtl"
              >
                {isStreamFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4 text-red-500" />
                    <span>خروج از تمام‌صفحه</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 text-red-500" />
                    <span>تمام‌صفحه</span>
                  </>
                )}
              </button>

              {/* IF LOCAL STREAMER (SHOWS WHAT IS STREAMING) */}
              {isLocalSharing ? (
                <div className="w-full h-full relative flex flex-col justify-center items-center bg-zinc-950">
                  <video
                    ref={(el) => {
                      (koochakVideoRef as any).current = el;
                      if (el && localStreamObject && el.srcObject !== localStreamObject) {
                        el.srcObject = localStreamObject;
                        el.play().catch(e => console.warn("local stream playback failed:", e));
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain max-h-[80vh] bg-black"
                  />
                  {/* Floating active stats for streamer */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none" dir="rtl">
                    <span className="bg-red-600/90 text-white text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>درحال استریم روی سرور ({streamQuality.toUpperCase()})</span>
                    </span>
                  </div>
                </div>
              ) : streamStatus.isLive && livekitVideoTrack ? (
                /* IF VIEWER & LIVEKIT SFU IS ACTIVE */
                <div className="w-full h-full relative flex flex-col justify-center items-center bg-zinc-950">
                  <LiveKitTrackRenderer track={livekitVideoTrack} />
                  
                  {/* Stats overlay for viewers */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none" dir="rtl">
                    <span className="bg-emerald-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                      <span>پخش زنده مستقیم (LiveKit)</span>
                    </span>

                    <div className="flex gap-2">
                      <span className="bg-black/85 text-zinc-400 text-[9px] font-mono px-2.5 py-1 rounded-full shadow border border-zinc-900">
                        کیفیت: {streamStatus.quality === 'high' ? '1080p' : streamStatus.quality === 'low' ? '360p' : '720p'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : streamStatus.isLive && !livekitVideoTrack ? (
                /* IF STREAM LIVE BUT WAITING FOR SFU CONNECTION */
                <div className="text-center p-8 space-y-4">
                  <div className="w-12 h-12 bg-rose-950/30 border border-rose-900/30 rounded-full flex items-center justify-center text-rose-400 mx-auto animate-spin">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">در حال دریافت ویدیوی لایو کیت...</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      سیستم در حال برقراری اتصال امن با سرور رسانه LiveKit است. لطفا منتظر بمانید.
                    </p>
                  </div>
                </div>
              ) : (
                /* NO ACTIVE STREAM */
                <div className="text-center p-8 space-y-4 max-w-sm">
                  <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-500 mx-auto">
                    <Tv className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">هیچ پخشی در جریان نیست</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      کاربری در حال حاضر پخش زنده ندارد. شما می‌توانید با کلیک بر روی دکمه شروع پخش، اولین استریمر باشید!
                    </p>
                  </div>
                </div>
              )}

              {/* Frame statistics or controls */}
              {streamStatus.isLive && (
                <div className="absolute bottom-4 left-4 right-4 bg-zinc-950/80 backdrop-blur-md border border-zinc-900 rounded-2xl p-3 flex items-center justify-between text-xs z-10" dir="rtl">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">LIVE</span>
                    <span className="text-zinc-400">فرستنده: <strong className="text-white">{streamStatus.streamer}</strong></span>
                  </div>

                  <div className="text-zinc-500 text-[10px] hidden sm:block">
                    روش: آپلود مستقیم فریم JPEG روی وب سرور
                  </div>

                  <div className="flex items-center gap-2 text-zinc-400">
                    <Eye className="w-4 h-4 text-red-500" />
                    <span className="font-mono text-[11px]">انتقال سروری غیر P2P</span>
                  </div>
                </div>
              )}

            </div>

            {/* Stream Zoom / Resize Controls Options */}
            <div className="bg-zinc-950/80 border border-zinc-900/60 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-right shadow-md" dir="rtl">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer border border-red-500/20"
                >
                  {isStreamFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      <span>خروج از تمام‌صفحه استریم</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span>تمام‌صفحه کردن استریم</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsStreamZoomed(!isStreamZoomed)}
                  className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-zinc-800 cursor-pointer shadow-md"
                >
                  <span>{isStreamZoomed ? "اندازه عادی نمایشگر" : "بزرگ‌کردن نمایشگر (داخل صفحه)"}</span>
                </button>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[11px] font-black text-white">تغییر اندازه نمایشگر پخش زنده</span>
                <span className="text-[9px] text-zinc-500 mt-0.5">برای مشاهده با جزئیات بیشتر، پخش زنده را تمام‌صفحه کنید یا اندازه آن را تغییر دهید</span>
              </div>
            </div>

          </div>

          {/* Chat Panel for YouTube Livestream (Right side) */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-900 bg-zinc-950/70 flex flex-col justify-between overflow-hidden shrink-0">
            
            <div className="bg-zinc-950 border-b border-zinc-900 p-3.5 flex items-center justify-between text-right shrink-0">
              <span className="text-[10px] bg-red-950 text-red-400 border border-red-900/40 font-mono font-bold px-2 py-0.5 rounded-full">STREAM CHAT</span>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>گفتگوی متنی تالار کوچک</span>
                <MessageCircle className="w-4 h-4 text-red-500" />
              </h3>
            </div>

            {/* Message window */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[250px] lg:max-h-none relative">
              {koochakLoading ? (
                <p className="text-[10px] text-zinc-600 text-center py-8">در حال بارگذاری چت...</p>
              ) : koochakChat.length === 0 ? (
                <p className="text-[10px] text-zinc-600 text-center py-8">پیامی هنوز فرستاده نشده است.</p>
              ) : (
                koochakChat.map((msg) => {
                  const isMe = msg.username === currentUser.username;
                  const isSys = msg.username === "سیستم";
                  const isGif = msg.text.startsWith("http") || msg.text.startsWith("/uploads") || msg.text.includes(".gif");
                  
                  if (isSys) {
                    return (
                      <div key={msg.id} className="bg-zinc-900/30 border border-zinc-900/60 p-2 rounded-xl text-center text-[9px] text-zinc-400">
                        {msg.text}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="text-right space-y-1 group/msg relative">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-zinc-600 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString("fa-IR", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setKoochakReplyTo({ id: msg.id, username: msg.username, text: msg.text })}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-0.5 bg-zinc-900 hover:bg-zinc-800 text-red-400 hover:text-red-300 rounded-md text-[8px] flex items-center gap-0.5 cursor-pointer"
                            title="پاسخ"
                          >
                            <CornerUpLeft className="w-2.5 h-2.5" />
                            <span>پاسخ</span>
                          </button>
                          <span className={`font-bold ${isMe ? "text-red-400" : "text-zinc-300"}`}>{msg.username}</span>
                        </div>
                      </div>

                      {/* Reply Reference Panel */}
                      {msg.replyToText && (
                        <div className="bg-zinc-900/80 border-r border-red-500 pr-1.5 pl-1 py-0.5 rounded text-[8px] text-zinc-400 mb-0.5 leading-normal max-w-[90%] truncate mr-auto inline-block">
                          پاسخ به <strong className="text-red-400">{msg.replyToUser}</strong>: {msg.replyToText}
                        </div>
                      )}

                      {/* Message body (Image/GIF or Text) */}
                      {isGif ? (
                        <div className={`p-1 rounded-xl bg-zinc-900 border border-zinc-850 overflow-hidden shadow-md max-w-[90%] inline-block ${isMe ? "ml-auto block text-left" : ""}`}>
                          <img
                            src={msg.text}
                            alt="uploaded gif"
                            referrerPolicy="no-referrer"
                            className="rounded-lg max-w-[150px] max-h-[120px] object-cover"
                          />
                        </div>
                      ) : (
                        <div className={`p-2 rounded-xl text-xs break-words inline-block max-w-[90%] ${
                          isMe ? "bg-red-950/20 text-red-100 border border-red-900/30 ml-auto block" : "bg-zinc-900 text-zinc-200"
                        }`}>
                          {msg.text}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={koochakChatEndRef} />
            </div>

            {/* Uploading GIF status */}
            {koochakUploadingGif && (
              <div className="bg-red-950/30 border-t border-red-900/30 text-red-300 text-[9px] px-3 py-1.5 flex items-center gap-2 animate-pulse justify-center">
                <Smile className="w-3.5 h-3.5 animate-spin" />
                <span>در حال آپلود و ارسال GIF...</span>
              </div>
            )}

            {/* Replying To Ribbon Bar */}
            {koochakReplyTo && (
              <div className="bg-red-950/40 border-t border-red-950/50 px-3 py-1.5 flex items-center justify-between text-[10px] text-red-300 shrink-0">
                <div className="flex items-center gap-1 truncate">
                  <CornerUpLeft className="w-3 h-3 shrink-0" />
                  <span>پاسخ به <strong className="font-extrabold text-white">{koochakReplyTo.username}</strong>:</span>
                  <span className="truncate max-w-[120px] text-[9px] text-zinc-500">"{koochakReplyTo.text}"</span>
                </div>
                <button
                  onClick={() => setKoochakReplyTo(null)}
                  className="p-0.5 hover:bg-red-900/20 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="bg-zinc-950 border-t border-zinc-900/80 p-3 shrink-0 relative">
              
              {/* GIF Selector Box Overlay for Koochak */}
              {koochakGifSelectorOpen && (
                <div className="absolute bottom-[100%] right-3 left-3 bg-zinc-950 border border-zinc-900 rounded-2xl p-2.5 shadow-2xl space-y-2 z-30 mb-2">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-[9px] font-black text-red-400">انتخاب یا بارگذاری گیف</span>
                    <button
                      onClick={() => setKoochakGifSelectorOpen(false)}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Preset GIFs grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {PRESET_GIFS.map((g) => (
                      <button
                        key={g.name}
                        onClick={() => {
                          handleSendKoochakChat(undefined, g.url);
                          setKoochakGifSelectorOpen(false);
                        }}
                        className="bg-zinc-900 hover:bg-red-950/10 border border-zinc-800 hover:border-red-900/25 rounded-lg p-1 text-center transition-all cursor-pointer relative group overflow-hidden"
                      >
                        <img
                          src={g.url}
                          alt={g.name}
                          className="w-full h-8 object-cover rounded-md mb-0.5"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[8px] text-zinc-500 font-bold group-hover:text-red-300">{g.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* File upload trigger */}
                  <div className="border-t border-zinc-900 pt-2">
                    <label className="flex items-center justify-center gap-1 bg-red-950/40 hover:bg-red-900/30 border border-red-900/30 rounded-lg px-2.5 py-1.5 cursor-pointer text-[9px] font-bold text-red-300 hover:text-white transition-all text-center">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>بارگذاری فایل GIF سفارشی</span>
                      <input
                        type="file"
                        accept="image/gif"
                        onChange={handleKoochakGifUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => handleSendKoochakChat(e)} className="flex gap-2">
                
                {/* GIF Selector trigger button */}
                <button
                  type="button"
                  onClick={() => setKoochakGifSelectorOpen(!koochakGifSelectorOpen)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    koochakGifSelectorOpen 
                      ? "bg-red-900/20 border-red-700 text-red-400" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800"
                  }`}
                  title="ارسال GIF"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>

                <input
                  type="text"
                  placeholder="نوشتن پیام در چت استریم..."
                  value={koochakInput}
                  onChange={(e) => setKoochakInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white text-right focus:outline-none focus:border-red-600"
                />

                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-500 text-white p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-md"
                >
                  <Send className="w-3.5 h-3.5 scale-x-[-1]" />
                </button>
              </form>
            </div>

          </div>

        </div>
      )}


      {/* Start Live Stream Dialog (YouTube-like mode setup) */}
      <AnimatePresence>
        {showGoLiveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans text-right"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <button
                  onClick={() => setShowGoLiveModal(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  انصراف
                </button>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
                  <span>تنظیمات پخش صفحه (بدون OBS)</span>
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">عنوان پخش زنده</label>
                  <input
                    type="text"
                    placeholder="مثلا: تحلیل مانگا، ماراتن مطالعه، طراحی دیجیتال..."
                    value={streamTitleInput}
                    onChange={(e) => setStreamTitleInput(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-red-600 text-right"
                  />
                </div>

                {/* Source selector */}
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">منبع ورودی پخش زنده</label>
                  <div className="grid grid-cols-2 gap-2">
                    
                    <button
                      type="button"
                      onClick={() => setStreamSource('screen')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                        streamSource === 'screen' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <div className="font-bold">اشتراک‌گذاری دسکتاپ</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">نیازمند باز کردن در تب جدید</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStreamSource('webcam')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                        streamSource === 'webcam' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      <div className="font-bold">دوربین / وب‌کم</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">سازگار کامل با پیش‌نمایش</div>
                    </button>

                  </div>
                </div>

                {/* Quality selector */}
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">تنظیم کیفیت آپلود فریم</label>
                  <div className="grid grid-cols-3 gap-2">
                    
                    <button
                      type="button"
                      onClick={() => handleQualityChange('low')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border ${
                        streamQuality === 'low' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="font-bold">Low (360p)</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">کمترین مصرف اینترنت</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQualityChange('medium')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border ${
                        streamQuality === 'medium' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="font-bold">Medium (720p)</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">متعادل و پایدار</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQualityChange('high')}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] transition-all cursor-pointer border ${
                        streamQuality === 'high' 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 font-bold' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="font-bold">High (1080p)</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">تصویر فوق‌العاده شفاف</div>
                    </button>

                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-850 p-3 rounded-xl text-[10px] text-zinc-400 leading-relaxed text-right space-y-1">
                  <p className="font-bold text-zinc-300">💡 راهنمای پخش زنده تالار:</p>
                  {streamSource === 'screen' ? (
                    <p>به دلیل محدودیت‌های امنیتی مرورگر درون فریم پیش‌نمایش، برای شروع پخش صفحه نمایش دسکتاپ حتما دکمه «باز کردن در تب جدید» در بالای صفحه را بزنید؛ یا همین حالا از گزینه پخش دوربین استفاده کنید.</p>
                  ) : (
                    <p>پخش وب‌کم به طور مستقیم در همین پنجره پیش‌نمایش پشتیبانی می‌شود و با کیفیت انتخابی شما روی سرور توزیع خواهد شد.</p>
                  )}
                </div>

                <button
                  onClick={startKoochakStream}
                  className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  {streamSource === 'webcam' ? "روشن کردن وب‌کم و شروع پخش زنده" : "انتخاب صفحه دسکتاپ و شروع استریم"}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
