import React, { useState, useEffect, useRef } from "react";
import { User, Post, Comment } from "../types";
import { 
  ArrowLeft, Play, Send, Video, Image as ImageIcon, Plus, 
  Search, Sparkles, Heart, Trash2, Calendar, MessageCircle, RefreshCw,
  UploadCloud, AlertCircle, X, Maximize
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MangaTimesProps {
  currentUser: User;
  onBack: () => void;
}

export default function MangaTimes({ currentUser, onBack }: MangaTimesProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "video" | "photo">("all");
  
  // Modal & form states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newContent, setNewContent] = useState<string>("");
  const [mediaType, setMediaType] = useState<"video" | "photo">("video");
  const [mediaUrl, setMediaUrl] = useState<string>("");

  // Media upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expandable comments tracking
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<{ [postId: string]: string }>({});
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ type: "video" | "photo" | "iframe"; url: string; title: string } | null>(null);

  // Load posts for "times"
  const loadPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/posts?type=times");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error("Error loading times posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleMediaTypeChange = (type: "video" | "photo") => {
    setMediaType(type);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setMediaUrl("");
    setUploadError("");
    setUploadProgress(null);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = async (file: File) => {
    if (!file) return;
    setUploadError("");

    // Validate size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("حداکثر حجم مجاز برای آپلود فایل ۵۰ مگابایت است.");
      return;
    }

    // Validate type matching mediaType selection
    if (mediaType === "video" && !file.type.startsWith("video/")) {
      setUploadError("فرمت فایل نامعتبر است. لطفاً یک فایل ویدیویی انتخاب کنید.");
      return;
    }
    if (mediaType === "photo" && !file.type.startsWith("image/")) {
      setUploadError("فرمت فایل نامعتبر است. لطفاً یک فایل تصویری انتخاب کنید.");
      return;
    }

    try {
      setSelectedFile(file);
      setIsUploading(true);
      setUploadProgress(10);

      // Generate local preview URL
      const previewUrl = URL.createObjectURL(file);
      setFilePreviewUrl(previewUrl);

      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 50); // Reading up to 50%
          setUploadProgress(10 + pct);
        }
      };

      reader.onload = async () => {
        try {
          setUploadProgress(70);
          const base64Data = reader.result as string;
          const payload = {
            name: file.name,
            fileData: base64Data
          };

          setUploadProgress(85);
          const res = await fetch("/api/upload-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const data = await res.json();
            setMediaUrl(data.url);
            setUploadProgress(100);
            setTimeout(() => {
              setUploadProgress(null);
              setIsUploading(false);
            }, 800);
          } else {
            const errData = await res.json();
            setUploadError(errData.error || "خطا در آپلود رسانه.");
            setIsUploading(false);
            setUploadProgress(null);
          }
        } catch (innerErr) {
          console.error(innerErr);
          setUploadError("خطا در پردازش اطلاعات فایل.");
          setIsUploading(false);
          setUploadProgress(null);
        }
      };

      reader.onerror = () => {
        setUploadError("خطا در خواندن فایل.");
        setIsUploading(false);
        setUploadProgress(null);
      };

      reader.readAsDataURL(file);

    } catch (err) {
      console.error(err);
      setUploadError("خطا در آپلود.");
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) {
      setUploadError("لطفاً تا اتمام آپلود فایل صبور باشید.");
      return;
    }
    if (!mediaUrl.trim()) {
      setUploadError("لطفاً یک فایل انتخاب و آپلود کنید.");
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const payload: any = {
        title: newTitle.trim(),
        content: newContent.trim(),
        author: currentUser.username,
        type: "times",
      };

      if (mediaType === "video") {
        payload.videoUrl = mediaUrl.trim();
      } else {
        payload.imageUrl = mediaUrl.trim();
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newPost = await res.json();
        setPosts(prev => [newPost, ...prev]);
        setIsCreateOpen(false);
        // Reset inputs
        setNewTitle("");
        setNewContent("");
        setMediaUrl("");
        setSelectedFile(null);
        setFilePreviewUrl(null);
        setUploadProgress(null);
        setUploadError("");
        setIsUploading(false);
      }
    } catch (err) {
      console.error("Error creating post:", err);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: data.likes } : p));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: currentUser.username,
          text,
        }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [...(p.comments || []), newComment]
            };
          }
          return p;
        }));
        setCommentTexts(prev => ({ ...prev, [postId]: "" }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
    } catch (_) {}
    return url;
  };

  // Filter & Search posts
  const filteredPosts = posts.filter(post => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === "video") {
      return matchesSearch && !!post.videoUrl;
    }
    if (activeFilter === "photo") {
      return matchesSearch && !!post.imageUrl;
    }
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-black text-[#f3f4f6] font-sans pb-16 pt-8">
      
      {/* Top Bar */}
      <div className="bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-900/60 sticky top-8 z-40 px-4 py-4 md:px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>بازگشت به هاب اصلی</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-950 text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-900/40 font-bold uppercase">TIMES EDITORIAL</span>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1">
              تالار <span className="text-amber-400">زمان</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8 md:px-8 space-y-6">
        
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-amber-950/10 to-orange-950/10 border border-[#2d251d] rounded-2xl p-6 md:p-8 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[30vw] h-[30vw] rounded-full bg-amber-600/5 blur-[80px] pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-right">
            <div>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2.5 py-1 rounded-full uppercase border border-amber-500/30">تحلیل‌ها، نقدها و ویدیوها</span>
              <h2 className="text-xl md:text-2xl font-black text-white mt-2.5">رسانه‌ها و ویدیوهای تالار زمان</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-xl">
                بخش اشتراک گذاری ویدیوهای جذاب، تریلرها، تصاویر و بحث‌های تحلیلی. محتوای دلخواه را با دوستان خود به اشتراک بگذارید، لایک کنید و دیدگاه بنویسید.
              </p>
            </div>
            
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-950/30 cursor-pointer self-start md:self-center font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>ارسال ویدیو یا عکس</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-zinc-950/60 border border-zinc-900/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between text-right">
          
          {/* Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0" dir="rtl">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === "all"
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              همه پست‌ها
            </button>
            <button
              onClick={() => setActiveFilter("video")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeFilter === "video"
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>ویدیوها</span>
            </button>
            <button
              onClick={() => setActiveFilter("photo")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeFilter === "photo"
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>عکس‌ها</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="جستجو در تالار زمان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800/80 rounded-xl py-2 px-10 text-white text-xs text-right focus:outline-none focus:border-amber-600 transition-colors"
            />
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          </div>

        </div>

        {/* Media Feed Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-zinc-500 text-xs font-semibold">در حال بارگذاری محتوا...</span>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950/30 rounded-2xl border border-dashed border-zinc-850 text-zinc-500 text-xs">
            {searchQuery ? "هیچ پستی یافت نشد." : "هنوز هیچ ویدیویی یا عکسی ارسال نشده است."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const hasVideo = !!post.videoUrl;
              const hasImage = !!post.imageUrl;
              const isLikedByMe = post.likes.includes(currentUser.username);
              const isExpanded = expandedPostId === post.id;

              return (
                <motion.div
                  key={post.id}
                  layout
                  className="bg-zinc-950/80 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl hover:border-amber-500/30 transition-all flex flex-col justify-between"
                >
                  
                  {/* Media content */}
                  <div className="bg-black relative overflow-hidden aspect-video group">
                    {hasVideo && post.videoUrl ? (
                      post.videoUrl.includes("youtube.com") || post.videoUrl.includes("youtu.be") ? (
                        <iframe
                          src={getEmbedUrl(post.videoUrl)}
                          className="w-full h-full border-0"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <video 
                          src={post.videoUrl} 
                          controls 
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                      )
                    ) : hasImage && post.imageUrl ? (
                      <img 
                        src={post.imageUrl} 
                        alt={post.title} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => setFullscreenMedia({ type: "photo", url: post.imageUrl!, title: post.title })}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-650">
                        <Video className="w-12 h-12 text-amber-500" />
                      </div>
                    )}

                    {/* Expand overlay button */}
                    {(hasImage || (hasVideo && post.videoUrl)) && (
                      <button
                        onClick={() => {
                          if (hasVideo && post.videoUrl) {
                            const isYoutube = post.videoUrl.includes("youtube.com") || post.videoUrl.includes("youtu.be");
                            setFullscreenMedia({ 
                              type: isYoutube ? "iframe" : "video", 
                              url: post.videoUrl, 
                              title: post.title 
                            });
                          } else if (hasImage && post.imageUrl) {
                            setFullscreenMedia({ 
                              type: "photo", 
                              url: post.imageUrl, 
                              title: post.title 
                            });
                          }
                        }}
                        className="absolute bottom-2.5 left-2.5 z-10 bg-black/75 hover:bg-black border border-zinc-800 text-zinc-300 hover:text-white p-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[10px] shadow-lg hover:scale-105 active:scale-95"
                        title="نمای بزرگ"
                      >
                        <Maximize className="w-3.5 h-3.5 text-amber-500" />
                        <span>بزرگنمایی</span>
                      </button>
                    )}

                    {/* Tag overlay */}
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest text-white shadow-lg ${
                        hasVideo ? "bg-amber-600" : "bg-zinc-800"
                      }`}>
                        {hasVideo ? "Video" : "Photo"}
                      </span>
                    </div>
                  </div>

                  {/* Body details */}
                  <div className="p-4 flex-1 flex flex-col justify-between text-right">
                    <div className="space-y-2.5">
                      
                      {/* Avatar & actions */}
                      <div className="flex items-center justify-between gap-1 border-b border-zinc-900/60 pb-2">
                        
                        {/* Delete action */}
                        {(post.author === currentUser.username || currentUser.role === "admin") && (
                          deletingPostId === post.id ? (
                            <div className="flex items-center gap-1 bg-zinc-950 px-1.5 py-0.5 rounded border border-rose-950/40 z-10">
                              <span className="text-[8px] text-rose-400">حذف؟</span>
                              <button
                                onClick={() => {
                                  handleDeletePost(post.id);
                                  setDeletingPostId(null);
                                }}
                                className="bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded text-[8px] hover:bg-rose-900 cursor-pointer"
                              >
                                بله
                              </button>
                              <button
                                onClick={() => setDeletingPostId(null)}
                                className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] hover:bg-zinc-700 cursor-pointer"
                              >
                                خیر
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingPostId(post.id)}
                              className="p-1 rounded-lg text-zinc-550 hover:text-rose-450 hover:bg-rose-950/20 transition-all cursor-pointer"
                              title="حذف پست"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-xs font-bold text-white">{post.author}</span>
                            <span className="block text-[9px] text-zinc-500 font-mono">
                              {new Date(post.createdAt).toLocaleDateString("fa-IR")}
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600/30 to-orange-600/30 border border-amber-900/40 flex items-center justify-center text-xs font-bold text-amber-300">
                            {post.author.charAt(0).toUpperCase()}
                          </div>
                        </div>

                      </div>

                      {/* Title & description */}
                      <div>
                        <h3 className="text-sm font-bold text-white line-clamp-1">{post.title}</h3>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {post.content}
                        </p>
                      </div>

                    </div>

                    {/* Footer Actions / Comments toggle */}
                    <div className="pt-3 border-t border-zinc-900 mt-3 flex items-center justify-between text-xs">
                      
                      <button
                        onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          isExpanded 
                            ? "bg-amber-950/40 text-amber-300 border border-amber-900/40" 
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <MessageCircle className="w-4 h-4 text-amber-400" />
                        <span>کامنت‌ها</span>
                        <span className="text-[10px] font-bold bg-zinc-900 px-1.5 py-0.2 rounded-full text-zinc-450">
                          {post.comments ? post.comments.length : 0}
                        </span>
                      </button>

                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                          isLikedByMe
                            ? "text-rose-500 bg-rose-950/10 border border-rose-900/20"
                            : "text-zinc-400 hover:text-rose-400"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLikedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
                        <span>لایک ({post.likes.length})</span>
                      </button>

                    </div>

                  </div>

                  {/* Expandable Comments */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-zinc-950/90 border-t border-zinc-900 overflow-hidden text-right"
                      >
                        <div className="p-4 space-y-3">
                          
                          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                            {!post.comments || post.comments.length === 0 ? (
                              <p className="text-[10px] text-zinc-500 text-center py-2">هنوز نظری ثبت نشده است. اولین نظر را بنویسید!</p>
                            ) : (
                              post.comments.map((comm) => (
                                <div key={comm.id} className="bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-900">
                                  <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="text-zinc-500 font-mono">
                                      {new Date(comm.createdAt).toLocaleTimeString("fa-IR", { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="font-bold text-amber-400">{comm.author}</span>
                                  </div>
                                  <p className="text-xs text-zinc-300 leading-relaxed pr-1">{comm.text}</p>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-zinc-900/40">
                            <input
                              type="text"
                              placeholder="نظر شما..."
                              value={commentTexts[post.id] || ""}
                              onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleAddComment(post.id);
                                }
                              }}
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white text-right focus:outline-none focus:border-amber-600"
                            />
                            <button
                              onClick={() => handleAddComment(post.id)}
                              className="p-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white cursor-pointer transition-all active:scale-95 shadow shrink-0"
                            >
                              <Send className="w-3.5 h-3.5 scale-x-[-1]" />
                            </button>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* Share New Post Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans text-right"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  انصراف
                </button>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>اشتراک رسانه جدید در تالار زمان</span>
                </h3>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-4">
                
                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">عنوان پست</label>
                  <input
                    type="text"
                    placeholder="عنوان ویدیو، تصویر یا تحلیل..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-amber-600 text-right"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">نوع رسانه</label>
                  <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-850">
                    <button
                      type="button"
                      onClick={() => handleMediaTypeChange("video")}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        mediaType === "video" ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>ویدیو</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMediaTypeChange("photo")}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        mediaType === "photo" ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>عکس / تصویر</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1 text-right">
                    {mediaType === "video" ? "انتخاب و آپلود ویدیو" : "انتخاب و آپلود عکس"}
                  </label>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        processFile(e.target.files[0]);
                      }
                    }}
                    accept={mediaType === "video" ? "video/*" : "image/*"}
                    className="hidden"
                  />

                  {/* Drag and Drop Zone */}
                  {!filePreviewUrl ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleZoneClick}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                        isDragging 
                          ? "border-amber-500 bg-amber-500/10 text-amber-300" 
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/70"
                      }`}
                    >
                      <UploadCloud className={`w-10 h-10 ${isDragging ? "text-amber-400 animate-bounce" : "text-zinc-500"}`} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">
                          {mediaType === "video"
                            ? "ویدیو خود را به اینجا بکشید یا برای انتخاب کلیک کنید"
                            : "عکس خود را به اینجا بکشید یا برای انتخاب کلیک کنید"}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          حداکثر حجم مجاز: ۵۰ مگابایت
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Preview and Upload State */
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                      {/* Media preview */}
                      <div className="relative aspect-video max-h-40 rounded-xl overflow-hidden bg-black border border-zinc-800/80 flex items-center justify-center">
                        {mediaType === "video" ? (
                          <video src={filePreviewUrl} className="w-full h-full object-contain" controls />
                        ) : (
                          <img src={filePreviewUrl} alt="Preview" className="w-full h-full object-contain" />
                        )}
                        
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setFilePreviewUrl(null);
                            setMediaUrl("");
                            setUploadProgress(null);
                            setUploadError("");
                            setIsUploading(false);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 hover:bg-black text-rose-400 hover:text-rose-300 transition-colors shadow-md cursor-pointer"
                          title="حذف و انتخاب مجدد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* File Details & Upload Progress */}
                      <div className="flex items-center justify-between text-xs border-t border-zinc-850 pt-2">
                        <div className="text-left font-mono text-[10px] text-zinc-500 max-w-[60%] truncate" dir="ltr">
                          {selectedFile?.name} ({selectedFile ? formatBytes(selectedFile.size) : ""})
                        </div>
                        <div className="text-right">
                          {isUploading ? (
                            <span className="text-amber-400 font-bold text-[10px] flex items-center gap-1">
                              <span className="animate-pulse">در حال آپلود...</span>
                            </span>
                          ) : mediaUrl ? (
                            <span className="text-emerald-400 font-bold text-[10px]">✓ آپلود موفقیت‌آمیز</span>
                          ) : (
                            <span className="text-rose-400 font-bold text-[10px]">خطا در آپلود</span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {uploadProgress !== null && (
                        <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-850">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            className="bg-amber-500 h-full"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {uploadError && (
                    <div className="mt-2 bg-rose-950/30 border border-rose-900/50 text-rose-300 text-[11px] py-2 px-3 rounded-xl flex items-center justify-between" dir="rtl">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{uploadError}</span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setUploadError("")} 
                        className="text-rose-400 hover:text-white font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs font-medium mb-1.5 mr-1">توضیحات و تحلیل</label>
                  <textarea
                    placeholder="تحلیل کوتاه یا توضیح درباره فایل ارسالی..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-amber-600 text-right"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  ارسال و نمایش در تالار زمان
                </button>

              </form>

            </motion.div>
          </motion.div>
        )}

        {/* Fullscreen Media Modal */}
        {fullscreenMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8"
            onClick={() => setFullscreenMedia(null)}
          >
            {/* Top Close Button & Info */}
            <div 
              className="absolute top-4 left-4 right-4 flex items-center justify-between text-white select-none z-50"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 font-sans tracking-tight">
                {fullscreenMedia.title}
              </h3>
              <button
                onClick={() => setFullscreenMedia(null)}
                className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 p-2 rounded-full transition-all text-zinc-400 hover:text-white cursor-pointer shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Content Box */}
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl max-h-[80vh] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl bg-zinc-950/40 border border-zinc-900/50"
              onClick={(e) => e.stopPropagation()}
            >
              {fullscreenMedia.type === "photo" && (
                <img 
                  src={fullscreenMedia.url} 
                  alt={fullscreenMedia.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[80vh] object-contain rounded-2xl"
                />
              )}

              {fullscreenMedia.type === "video" && (
                <video 
                  src={fullscreenMedia.url} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-[80vh] object-contain rounded-2xl"
                  preload="auto"
                />
              )}

              {fullscreenMedia.type === "iframe" && (
                <div className="w-full aspect-video rounded-2xl overflow-hidden">
                  <iframe
                    src={getEmbedUrl(fullscreenMedia.url)}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="autoplay"
                  ></iframe>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
