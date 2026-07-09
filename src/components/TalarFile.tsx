import React, { useState, useEffect, useRef } from "react";
import { User, SharedFile } from "../types";
import { 
  ArrowLeft, UploadCloud, FileText, Download, Trash2, Search, 
  FileCode, FileArchive, FileImage, FileVideo, FileAudio, File as GenericFile, Sparkles, AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TalarFileProps {
  currentUser: User;
  onBack: () => void;
}

export default function TalarFile({ currentUser, onBack }: TalarFileProps) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load shared files from server
  const loadFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error loading files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const size = "w-6 h-6";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return <FileImage className={`${size} text-emerald-400`} />;
    }
    if (["mp4", "webm", "mkv", "avi"].includes(ext)) {
      return <FileVideo className={`${size} text-rose-400`} />;
    }
    if (["mp3", "wav", "ogg", "flac"].includes(ext)) {
      return <FileAudio className={`${size} text-amber-400`} />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
      return <FileArchive className={`${size} text-yellow-500`} />;
    }
    if (["js", "ts", "tsx", "html", "css", "json", "py", "sh", "cpp"].includes(ext)) {
      return <FileCode className={`${size} text-blue-400`} />;
    }
    if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(ext)) {
      return <FileText className={`${size} text-indigo-400`} />;
    }
    return <GenericFile className={`${size} text-zinc-400`} />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const processUpload = async (file: File) => {
    if (!file) return;
    setErrorMessage("");

    try {
      setUploadProgress(10);
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 50); // reading up to 50%
          setUploadProgress(10 + pct);
        }
      };

      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          setUploadProgress(70);

          const payload = {
            name: file.name,
            size: file.size,
            description: description.trim(),
            uploader: currentUser.username,
            fileData: base64Data
          };

          setUploadProgress(85);
          const res = await fetch("/api/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const newFile = await res.json();
            setFiles(prev => [newFile, ...prev]);
            setDescription("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            setUploadProgress(100);
            setTimeout(() => setUploadProgress(null), 1000);
          } else {
            const errData = await res.json();
            setErrorMessage(errData.error || "خطا در آپلود فایل رخ داد.");
            setUploadProgress(null);
          }
        } catch (innerErr) {
          console.error(innerErr);
          setErrorMessage("خطا در پردازش اطلاعات فایل.");
          setUploadProgress(null);
        }
      };

      reader.onerror = () => {
        setErrorMessage("خطا در خواندن فایل.");
        setUploadProgress(null);
      };

      reader.readAsDataURL(file);

    } catch (err) {
      console.error(err);
      setErrorMessage("خطا در ارتباط با سرور.");
      setUploadProgress(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.uploader.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-[#f3f4f6] font-sans pb-16 pt-8">
      
      {/* Top Header */}
      <div className="bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-900/60 relative z-20 px-4 py-4 md:px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900/40 border border-zinc-850 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>بازگشت به هاب اصلی</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-950 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-900/40 font-bold uppercase">FILE CABINET</span>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1">
              تالار <span className="text-emerald-400">فایل</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8 md:px-8 space-y-8">
        
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-emerald-950/10 to-teal-950/10 border border-emerald-950/30 rounded-2xl p-6 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[30vw] h-[30vw] rounded-full bg-emerald-600/5 blur-[80px] pointer-events-none"></div>
          <div className="relative z-10 text-right space-y-2">
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-1 rounded-full uppercase border border-emerald-500/30">اشتراک‌گذاری مستقیم فایل</span>
            <h2 className="text-xl font-black text-white">بایگانی و اشتراک‌گذاری فایل‌های گروه</h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
              هر نوع فایلی (عکس، ویدیو، جزوه، فشرده یا داکیومنت) را بدون هیچ محدودیتی بارگذاری کنید تا بقیه دوستان بتوانند آن را با سرعت مستقیم دانلود کنند.
            </p>
          </div>
        </div>

        {/* Upload & List Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload box */}
          <div className="lg:col-span-1 space-y-4 text-right">
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                <span>بارگذاری فایل جدید</span>
                <UploadCloud className="w-4 h-4 text-emerald-400" />
              </h3>

              {/* Drag n drop box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  isDragging 
                    ? "border-emerald-500 bg-emerald-950/10" 
                    : "border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/20"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className={`w-10 h-10 transition-colors ${isDragging ? "text-emerald-400 animate-bounce" : "text-zinc-500"}`} />
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-300">انتخاب فایل یا رها کردن اینجا</p>
                  <p className="text-[10px] text-zinc-500 mt-1">بدون هیچ محدودیتی در حجم فایل</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-zinc-400 text-xs">توضیح کوتاه درباره فایل (اختیاری)</label>
                <textarea
                  placeholder="مثلا: چپتر جدید ترجمه شده، یا پوستر باکیفیت..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-900/95 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs text-right focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Progress and status */}
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400">
                    <span>{uploadProgress}%</span>
                    <span>در حال آپلود فایل...</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-1.5 bg-rose-950/30 border border-rose-900/40 p-3 rounded-xl text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Files List */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Filter Search */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="جستجو در نام فایل، توضیحات یا فرستنده..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2 px-10 text-white text-xs text-right focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="text-center py-16 text-zinc-500 text-xs">در حال بارگذاری فایل‌ها...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-16 bg-zinc-950/20 border border-dashed border-zinc-850 rounded-2xl text-zinc-500 text-xs">
                {searchQuery ? "هیچ فایلی با این نام پیدا نشد." : "هنوز فایلی در تالار قرار نگرفته است."}
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredFiles.map((file) => (
                    <motion.div
                      key={file.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-zinc-950/90 border border-zinc-900/80 p-4 rounded-2xl flex items-center justify-between gap-4 text-right hover:border-emerald-500/20 transition-all shadow-md"
                    >
                      
                      {/* Left: Action download & delete */}
                      <div className="flex items-center gap-2">
                        {(file.uploader === currentUser.username || currentUser.role === "admin") && (
                          deletingFileId === file.id ? (
                            <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-xl border border-rose-900/30 z-10">
                              <span className="text-[9px] text-rose-400">حذف؟</span>
                              <button
                                onClick={() => {
                                  handleDeleteFile(file.id);
                                  setDeletingFileId(null);
                                }}
                                className="bg-rose-950 text-rose-400 px-2 py-1 rounded-lg text-[9px] hover:bg-rose-900 cursor-pointer animate-fadeIn"
                              >
                                بله
                              </button>
                              <button
                                onClick={() => setDeletingFileId(null)}
                                className="bg-zinc-850 text-zinc-400 px-2 py-1 rounded-lg text-[9px] hover:bg-zinc-800 cursor-pointer"
                              >
                                خیر
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingFileId(file.id)}
                              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/20 text-zinc-500 hover:text-rose-400 border border-zinc-850 hover:border-rose-900/30 transition-all cursor-pointer"
                              title="حذف فایل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )
                        )}

                        <a
                          href={file.downloadUrl}
                          download={file.name}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>دانلود</span>
                        </a>
                      </div>

                      {/* Right: File details */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                        
                        <div className="min-w-0 text-right flex-1 space-y-1">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] text-zinc-500 font-mono">({formatBytes(file.size)})</span>
                            <span className="text-xs font-bold text-white block truncate max-w-xs" dir="ltr">{file.name}</span>
                          </div>
                          
                          {file.description && (
                            <p className="text-[11px] text-zinc-400 line-clamp-1">{file.description}</p>
                          )}

                          <div className="flex items-center gap-2 justify-end text-[10px] text-zinc-500">
                            <span>{new Date(file.createdAt).toLocaleDateString("fa-IR")}</span>
                            <span>•</span>
                            <span>توسط: <strong className="text-emerald-400">{file.uploader}</strong></span>
                          </div>
                        </div>

                        {/* File icon */}
                        <div className="w-11 h-11 bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-center shrink-0">
                          {getFileIcon(file.name)}
                        </div>

                      </div>

                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
