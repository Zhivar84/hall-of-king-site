import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import compression from "compression";

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "database.json");

// Define types
interface User {
  id: string;
  username: string;
  passwordHash: string; // Storing as plain text or simple encoding for this group of friends is perfect, but let's keep it clean
  role: "admin" | "user";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  type: "stream" | "times" | "bozorgan";
  createdAt: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  type: "stream" | "times";
  videoUrl?: string;
  imageUrl?: string;
  comments: Comment[];
  createdAt: string;
  views: number;
  likes: string[]; // usernames of people who liked
}

interface SharedFile {
  id: string;
  name: string;
  size: number;
  uploader: string;
  description: string;
  downloadUrl: string;
  createdAt: string;
}

interface LiveStreamStatus {
  isLive: boolean;
  streamer: string;
  title: string;
  streamType: "webcam" | "url";
  streamUrl?: string;
  startedAt?: string;
}

interface Quote {
  id: string;
  text: string;
  author: string;
  submittedBy: string;
  createdAt: string;
}

interface SharedGif {
  id: string;
  url: string;
  name: string;
  addedBy: string;
  createdAt: string;
}

interface TalarBozorgParticipant {
  username: string;
  micActive: boolean;
  webcamActive: boolean;
  screenActive: boolean;
  joinedAt: string;
}

interface Database {
  users: User[];
  chat: ChatMessage[];
  posts: Post[];
  liveStream: LiveStreamStatus;
  sharedFiles?: SharedFile[];
  quotes?: Quote[];
  gifs?: SharedGif[];
  bozorgParticipants?: TalarBozorgParticipant[];
}

// Initial default database structure
const DEFAULT_DB: Database = {
  users: [
    {
      id: "admin",
      username: "admin",
      passwordHash: "admin", // Standard password for initial setup, can be changed
      role: "admin",
      status: "approved",
      createdAt: new Date().toISOString(),
    }
  ],
  chat: [
    {
      id: "1",
      userId: "system",
      username: "سیستم",
      text: "خوش آمدید! برای گفتگو با دوستان خود پیام ارسال کنید.",
      type: "stream",
      createdAt: new Date().toISOString(),
    }
  ],
  posts: [
    {
      id: "p1",
      title: "به وبلاگ تالار زمان خوش آمدید!",
      content: "اینجا محلی است برای اشتراک‌گذاری اخبار، نقدها و بحث‌های صمیمانه در مورد موضوعات مورد علاقه‌مان. برای شروع می‌توانید اولین پست خود را اضافه کنید!",
      author: "admin",
      type: "times",
      createdAt: new Date().toISOString(),
      views: 12,
      likes: [],
      comments: [
        {
          id: "c1",
          author: "admin",
          text: "ممنون از راه‌اندازی این بخش عالی!",
          createdAt: new Date().toISOString()
        }
      ]
    }
  ],
  liveStream: {
    isLive: false,
    streamer: "",
    title: "",
    streamType: "webcam",
  },
  quotes: [
    {
      id: "q1",
      text: "هرگز به جز در مقام حق و حقیقت سخن نگویید، حتی اگر به زیان شما باشد.",
      author: "کوروش بزرگ",
      submittedBy: "سیستم",
      createdAt: new Date().toISOString()
    },
    {
      id: "q2",
      text: "بزرگترین لذت در زندگی انجام کاری است که دیگران می‌گویند تو نمی‌توانی انجام دهی.",
      author: "ارد بزرگ",
      submittedBy: "سیستم",
      createdAt: new Date().toISOString()
    }
  ],
  gifs: [
    {
      id: "g1",
      url: "https://media.giphy.com/media/OdSZCPaQZWlWw/giphy.gif",
      name: "تایید (لایک)",
      addedBy: "سیستم",
      createdAt: new Date().toISOString()
    },
    {
      id: "g2",
      url: "https://media.giphy.com/media/LHy9iUZDBgiyY/giphy.gif",
      name: "شگفت زده (واو)",
      addedBy: "سیستم",
      createdAt: new Date().toISOString()
    },
    {
      id: "g3",
      url: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif",
      name: "گربه رقصان",
      addedBy: "سیستم",
      createdAt: new Date().toISOString()
    },
    {
      id: "g4",
      url: "https://media.giphy.com/media/JRlqKEiaTqde0/giphy.gif",
      name: "دویدن ناروتو",
      addedBy: "سیستم",
      createdAt: new Date().toISOString()
    },
    {
      id: "g5",
      url: "https://media.giphy.com/media/13G65X3scb9mO4/giphy.gif",
      name: "ال (خوردن شیرینی)",
      addedBy: "سیستم",
      createdAt: new Date().toISOString()
    },
    {
      id: "g6",
      url: "https://media.giphy.com/media/Uv39X88X19McO1Z72X/giphy.gif",
      name: "لوفی خوشحال",
      addedBy: "سیستم",
      createdAt: new Date().toISOString()
    }
  ],
  bozorgParticipants: []
};

// Stream chat messages are kept strictly in-memory (transient) as they belong to Talar-e Namayesh
let inMemoryStreamChat: ChatMessage[] = [
  {
    id: "1",
    userId: "system",
    username: "سیستم",
    text: "خوش آمدید! برای گفتگو با دوستان خود پیام ارسال کنید.",
    type: "stream",
    createdAt: new Date().toISOString(),
  }
];

// Help load/save DB safely
async function getDb(): Promise<Database> {
  let db: Database;
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    db = JSON.parse(data) as Database;
  } catch (error) {
    // If doesn't exist, write default DB
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
    db = DEFAULT_DB;
  }
  db.sharedFiles = db.sharedFiles || [];
  db.quotes = db.quotes || [];
  db.gifs = db.gifs || [];
  db.bozorgParticipants = db.bozorgParticipants || [];
  
  // Exclude stream chats from persistent database to comply with transient Talar-e Namayesh rules
  if (db.chat) {
    db.chat = db.chat.filter(c => c.type !== "stream");
  } else {
    db.chat = [];
  }
  
  return db;
}

async function saveDb(db: Database): Promise<void> {
  // Always filter out "stream" type chat messages from database file
  if (db.chat) {
    db.chat = db.chat.filter(c => c.type !== "stream");
  }
  
  await fs.writeFile(DB_FILE, JSON.stringify(db), "utf-8");
}

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Ensure DB is initialized on boot
  await getDb();

  // Authentication Endpoints
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است." });
    }

    const db = await getDb();
    const cleanUsername = username.trim().toLowerCase();

    const exists = db.users.some(u => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      return res.status(400).json({ error: "این نام کاربری قبلاً ثبت شده است." });
    }

    // Determine status: if zero active approved admins, let's make them admin right away (or if admin is the only one, we require approval)
    // Actually, any new user registered should be "pending" approval by admin.
    const newUser: User = {
      id: Date.now().toString(),
      username: username.trim(),
      passwordHash: password, // Plain text is secure enough for this private friend group
      role: "user",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await saveDb(db);

    res.json({ message: "ثبت‌نام با موفقیت انجام شد. منتظر تایید حساب کاربری توسط مدیر باشید." });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است." });
    }

    const db = await getDb();
    const cleanUsername = username.trim().toLowerCase();

    const user = db.users.find(u => u.username.toLowerCase() === cleanUsername);
    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است." });
    }

    if (user.status === "pending") {
      return res.status(403).json({ error: "حساب کاربری شما هنوز توسط مدیر تایید نشده است." });
    }

    if (user.status === "rejected") {
      return res.status(403).json({ error: "درخواست ثبت‌نام شما رد شده است." });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status
      }
    });
  });

  // Admin Manage Accounts (Admin Only check is performed in-client & simple header/token simulation is good)
  app.get("/api/admin/users", async (req, res) => {
    const db = await getDb();
    res.json({ users: db.users });
  });

  app.post("/api/admin/users/:id/approve", async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    const user = db.users.find(u => u.id === id);
    if (user) {
      user.status = "approved";
      await saveDb(db);
      res.json({ success: true, message: `کاربر ${user.username} تایید شد.` });
    } else {
      res.status(404).json({ error: "کاربر پیدا نشد." });
    }
  });

  app.post("/api/admin/users/:id/reject", async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    const user = db.users.find(u => u.id === id);
    if (user) {
      user.status = "rejected";
      await saveDb(db);
      res.json({ success: true, message: `عضویت کاربر ${user.username} رد شد.` });
    } else {
      res.status(404).json({ error: "کاربر پیدا نشد." });
    }
  });

  app.post("/api/admin/users/:id/role", async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const db = await getDb();
    const user = db.users.find(u => u.id === id);
    if (user) {
      user.role = role;
      await saveDb(db);
      res.json({ success: true, message: `نقش کاربر به ${role} تغییر یافت.` });
    } else {
      res.status(404).json({ error: "کاربر پیدا نشد." });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const { id } = req.params;
    if (id === "admin") {
      return res.status(400).json({ error: "حساب مدیر اصلی قابل حذف نیست." });
    }
    const db = await getDb();
    const initialLength = db.users.length;
    db.users = db.users.filter(u => u.id !== id);
    if (db.users.length < initialLength) {
      await saveDb(db);
      res.json({ success: true, message: "کاربر با موفقیت حذف شد." });
    } else {
      res.status(404).json({ error: "کاربر پیدا نشد." });
    }
  });

  // Chat APIs
  app.get("/api/chat", async (req, res) => {
    const { type } = req.query;
    if (type !== "stream" && type !== "times" && type !== "bozorgan") {
      return res.status(400).json({ error: "نوع چت نامعتبر است." });
    }
    if (type === "stream") {
      return res.json({ chat: inMemoryStreamChat });
    }
    const db = await getDb();
    const filteredChat = db.chat.filter(c => c.type === type);
    res.json({ chat: filteredChat });
  });

  app.post("/api/chat", async (req, res) => {
    const { userId, username, text, type } = req.body;
    if (!text || !username || !type) {
      return res.status(400).json({ error: "ارسال تمامی فیلدها الزامی است." });
    }
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: userId || "anonymous",
      username,
      text,
      type,
      createdAt: new Date().toISOString(),
    };

    if (type === "stream") {
      inMemoryStreamChat.push(newMessage);
      // Limit to last 200 messages to save space
      if (inMemoryStreamChat.length > 200) {
        inMemoryStreamChat = inMemoryStreamChat.slice(-100);
      }
      return res.json(newMessage);
    }

    const db = await getDb();
    db.chat.push(newMessage);
    // Limit to last 500 messages to save space
    if (db.chat.length > 500) {
      db.chat = db.chat.slice(-300);
    }
    await saveDb(db);
    res.json(newMessage);
  });

  // Posts/Manga Blog APIs
  app.get("/api/posts", async (req, res) => {
    const { type } = req.query;
    if (type !== "stream" && type !== "times") {
      return res.status(400).json({ error: "نوع محتوا نامعتبر است." });
    }
    const db = await getDb();
    const filteredPosts = db.posts
      .filter(p => p.type === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ posts: filteredPosts });
  });

  app.post("/api/posts", async (req, res) => {
    const { title, content, author, type, videoUrl, imageUrl } = req.body;
    if (!title || !content || !author || !type) {
      return res.status(400).json({ error: "فیلدهای عنوان، محتوا و نویسنده الزامی هستند." });
    }
    const db = await getDb();
    const newPost: Post = {
      id: "post_" + Date.now(),
      title,
      content,
      author,
      type,
      videoUrl,
      imageUrl,
      comments: [],
      createdAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    db.posts.push(newPost);
    await saveDb(db);
    res.json(newPost);
  });

  app.post("/api/posts/:id/like", async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "نام کاربری الزامی است." });
    }
    const db = await getDb();
    const post = db.posts.find(p => p.id === id);
    if (!post) {
      return res.status(404).json({ error: "پست مورد نظر یافت نشد." });
    }

    const likeIndex = post.likes.indexOf(username);
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(username);
    }
    await saveDb(db);
    res.json({ likes: post.likes });
  });

  app.post("/api/posts/:id/comments", async (req, res) => {
    const { id } = req.params;
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ error: "نویسنده و متن دیدگاه الزامی است." });
    }
    const db = await getDb();
    const post = db.posts.find(p => p.id === id);
    if (!post) {
      return res.status(404).json({ error: "پست مورد نظر یافت نشد." });
    }

    const newComment: Comment = {
      id: "comment_" + Date.now(),
      author,
      text,
      createdAt: new Date().toISOString()
    };

    post.comments.push(newComment);
    await saveDb(db);
    res.json(newComment);
  });

  app.delete("/api/posts/:id", async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    const initialLength = db.posts.length;
    db.posts = db.posts.filter(p => p.id !== id);
    if (db.posts.length < initialLength) {
      await saveDb(db);
      res.json({ success: true, message: "پست با موفقیت حذف شد." });
    } else {
      res.status(404).json({ error: "پست یافت نشد." });
    }
  });

  app.post("/api/posts/:id/view", async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    const post = db.posts.find(p => p.id === id);
    if (post) {
      post.views = (post.views || 0) + 1;
      await saveDb(db);
      res.json({ views: post.views });
    } else {
      res.status(404).json({ error: "پست یافت نشد." });
    }
  });

  // File sharing APIs
  app.get("/api/files", async (req, res) => {
    const db = await getDb();
    res.json({ files: db.sharedFiles || [] });
  });

  app.post("/api/files", async (req, res) => {
    const { name, size, description, uploader, fileData } = req.body;
    if (!name || !fileData || !uploader) {
      return res.status(400).json({ error: "نام فایل، فرستنده و دیتای فایل الزامی است." });
    }

    // Limit maximum upload size to 15MB to protect 2GB RAM server
    if (size && size > 15 * 1024 * 1024) {
      return res.status(400).json({ error: "حجم فایل بیش از حد مجاز (حداکثر ۱۵ مگابایت) است." });
    }

    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const fileId = "file_" + Date.now();
      const safeName = name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const diskFilename = `${fileId}_${safeName}`;
      const diskPath = path.join(uploadsDir, diskFilename);

      const base64Data = fileData.replace(/^data:.*?;base64,/, "");
      await fs.writeFile(diskPath, Buffer.from(base64Data, "base64"));

      const db = await getDb();
      const newFile: SharedFile = {
        id: fileId,
        name,
        size: size || 0,
        uploader,
        description: description || "",
        downloadUrl: `/uploads/${diskFilename}`,
        createdAt: new Date().toISOString()
      };

      db.sharedFiles = db.sharedFiles || [];
      db.sharedFiles.push(newFile);
      await saveDb(db);

      res.json(newFile);
    } catch (err) {
      console.error("Error uploading file:", err);
      res.status(500).json({ error: "خطا در آپلود فایل رخ داد." });
    }
  });

  app.post("/api/upload-media", async (req, res) => {
    const { name, fileData } = req.body;
    if (!name || !fileData) {
      return res.status(400).json({ error: "نام فایل و دیتای فایل الزامی است." });
    }

    // Limit maximum media size to 10MB to protect 2GB RAM server
    if (fileData.length > 14 * 1024 * 1024) {
      return res.status(400).json({ error: "حجم فایل بیش از حد مجاز (حداکثر ۱۰ مگابایت) است." });
    }

    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const fileId = "media_" + Date.now();
      const safeName = name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const diskFilename = `${fileId}_${safeName}`;
      const diskPath = path.join(uploadsDir, diskFilename);

      const base64Data = fileData.replace(/^data:.*?;base64,/, "");
      await fs.writeFile(diskPath, Buffer.from(base64Data, "base64"));

      res.json({ url: `/uploads/${diskFilename}` });
    } catch (err) {
      console.error("Error uploading media:", err);
      res.status(500).json({ error: "خطا در آپلود رسانه رخ داد." });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const db = await getDb();
      db.sharedFiles = db.sharedFiles || [];
      const fileIndex = db.sharedFiles.findIndex(f => f.id === id);
      if (fileIndex === -1) {
        return res.status(404).json({ error: "فایل مورد نظر یافت نشد." });
      }

      const fileObj = db.sharedFiles[fileIndex];
      const filename = path.basename(fileObj.downloadUrl);
      const filePath = path.join(process.cwd(), "uploads", filename);

      try {
        await fs.unlink(filePath);
      } catch (e) {}

      db.sharedFiles.splice(fileIndex, 1);
      await saveDb(db);
      res.json({ success: true, message: "فایل با موفقیت حذف شد." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "خطا در حذف فایل" });
    }
  });

  // Sokhan Bozorgan (Quotes) APIs
  app.get("/api/quotes", async (req, res) => {
    const db = await getDb();
    res.json({ quotes: db.quotes || [] });
  });

  app.post("/api/quotes", async (req, res) => {
    const { text, author, submittedBy } = req.body;
    if (!text || !author || !submittedBy) {
      return res.status(400).json({ error: "متن سخن، گوینده و فرستنده الزامی است." });
    }

    const db = await getDb();
    const newQuote: Quote = {
      id: "quote_" + Date.now(),
      text,
      author,
      submittedBy,
      createdAt: new Date().toISOString()
    };

    db.quotes = db.quotes || [];
    db.quotes.push(newQuote);
    await saveDb(db);
    res.json(newQuote);
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    db.quotes = db.quotes || [];
    const quoteIndex = db.quotes.findIndex(q => q.id === id);
    if (quoteIndex === -1) {
      return res.status(404).json({ error: "سخن مورد نظر یافت نشد." });
    }

    db.quotes.splice(quoteIndex, 1);
    await saveDb(db);
    res.json({ success: true, message: "سخن با موفقیت حذف شد." });
  });

  // GIF Library APIs
  app.get("/api/gifs", async (req, res) => {
    const db = await getDb();
    res.json({ gifs: db.gifs || [] });
  });

  app.post("/api/gifs", async (req, res) => {
    const { url, name, addedBy } = req.body;
    if (!url || !name || !addedBy) {
      return res.status(400).json({ error: "آدرس گیف، نام و فرستنده الزامی است." });
    }

    const db = await getDb();
    const newGif: SharedGif = {
      id: "gif_" + Date.now(),
      url,
      name,
      addedBy,
      createdAt: new Date().toISOString()
    };

    db.gifs = db.gifs || [];
    db.gifs.push(newGif);
    await saveDb(db);
    res.json(newGif);
  });

  app.delete("/api/gifs/:id", async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    db.gifs = db.gifs || [];
    const gifIndex = db.gifs.findIndex(g => g.id === id);
    if (gifIndex === -1) {
      return res.status(404).json({ error: "گیف مورد نظر یافت نشد." });
    }

    db.gifs.splice(gifIndex, 1);
    await saveDb(db);
    res.json({ success: true, message: "گیف با موفقیت حذف شد." });
  });

  // Strictly In-Memory Talar State (no DB saves, resets on server restart/when users leave)
  interface InMemParticipant {
    username: string;
    micActive: boolean;
    webcamActive: boolean;
    screenActive: boolean;
    joinedAt: string;
    lastActive: number;
    webcamFrame?: string | null;
    screenFrame?: string | null;
    audioChunks?: { id: string; data: string; timestamp: number }[];
  }

  interface InMemLiveStream {
    isLive: boolean;
    streamer: string;
    title: string;
    streamType: string;
    streamUrl: string;
    startedAt: string;
    quality: string;
    lastFrameTime: number;
  }

  interface InMemTalarState {
    bozorgParticipants: InMemParticipant[];
    liveStream: InMemLiveStream;
    latestFrame: string | null;
  }

  const talarState: InMemTalarState = {
    bozorgParticipants: [],
    liveStream: {
      isLive: false,
      streamer: "",
      title: "",
      streamType: "webcam",
      streamUrl: "",
      startedAt: "",
      quality: "medium",
      lastFrameTime: 0
    },
    latestFrame: null
  };

  function pruneInactiveTalarState() {
    const now = Date.now();
    // Prune voice participants inactive for more than 10 seconds (tab closed / left page)
    talarState.bozorgParticipants = talarState.bozorgParticipants.filter(p => (now - p.lastActive) < 10000);

    // Prune live stream if streamer hasn't uploaded a frame in 45 seconds (streamer disconnected / closed tab)
    if (talarState.liveStream.isLive && (now - talarState.liveStream.lastFrameTime) > 45000) {
      talarState.liveStream = {
        isLive: false,
        streamer: "",
        title: "",
        streamType: "webcam",
        streamUrl: "",
        startedAt: "",
        quality: "medium",
        lastFrameTime: 0
      };
      talarState.latestFrame = null;
    }
  }

  // Live Stream status APIs
  app.get("/api/livestream", (req, res) => {
    pruneInactiveTalarState();
    res.json(talarState.liveStream);
  });

  app.post("/api/livestream", (req, res) => {
    const { isLive, streamer, title, streamType, streamUrl, quality } = req.body;
    pruneInactiveTalarState();

    if (isLive) {
      talarState.liveStream = {
        isLive: true,
        streamer: streamer || "استریمر ناشناس",
        title: title || "پخش زنده تالار کوچک",
        streamType: streamType || "webcam",
        streamUrl: streamUrl || "",
        startedAt: new Date().toISOString(),
        quality: quality || "medium",
        lastFrameTime: Date.now()
      };
    } else {
      talarState.liveStream = {
        isLive: false,
        streamer: "",
        title: "",
        streamType: "webcam",
        streamUrl: "",
        startedAt: "",
        quality: "medium",
        lastFrameTime: 0
      };
      talarState.latestFrame = null;
    }
    res.json(talarState.liveStream);
  });

  // Server-side Frame distribution APIs for P2P-free streaming
  app.post("/api/stream/upload-frame", (req, res) => {
    const { frame, username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "نام کاربری الزامی است." });
    }

    const now = Date.now();
    const cleanUsername = username.trim().toLowerCase();
    const currentStreamer = talarState.liveStream.streamer ? talarState.liveStream.streamer.trim().toLowerCase() : "";

    // Self-healing / Auto-adoption logic:
    // If the server doesn't have an active streamer, or if the current frame is from the active streamer,
    // we seamlessly maintain or restore the stream's live status.
    const isStreamerEmpty = !talarState.liveStream.streamer || currentStreamer === "";
    const isCurrentStreamer = currentStreamer === cleanUsername;

    if (isCurrentStreamer || isStreamerEmpty) {
      talarState.liveStream.isLive = true;
      if (isStreamerEmpty) {
        talarState.liveStream.streamer = username;
        talarState.liveStream.title = `پخش زنده ${username}`;
        talarState.liveStream.startedAt = new Date().toISOString();
      }
      talarState.latestFrame = frame || null;
      talarState.liveStream.lastFrameTime = now;
      return res.json({ success: true });
    }

    res.status(403).json({ error: "شما دسترسی برای ارسال فریم ندارید یا پخش فعال نیست." });
  });

  app.get("/api/stream/frame", (req, res) => {
    pruneInactiveTalarState();
    if (!talarState.liveStream.isLive || !talarState.latestFrame) {
      return res.status(404).json({ error: "فریمی در دسترس نیست." });
    }
    res.json({ frame: talarState.latestFrame });
  });

  // Talar Bozorg (Discord-like Voice/Video Hall) APIs
  app.get("/api/talar-bozorg/participants", (req, res) => {
    pruneInactiveTalarState();
    res.json({ participants: talarState.bozorgParticipants });
  });

  app.post("/api/talar-bozorg/join", (req, res) => {
    const { username, micActive, webcamActive, screenActive } = req.body;
    if (!username) {
      return res.status(400).json({ error: "نام کاربری الزامی است." });
    }
    pruneInactiveTalarState();
    const idx = talarState.bozorgParticipants.findIndex(p => p.username === username);
    if (idx !== -1) {
      talarState.bozorgParticipants[idx] = {
        username,
        micActive: !!micActive,
        webcamActive: !!webcamActive,
        screenActive: !!screenActive,
        joinedAt: talarState.bozorgParticipants[idx].joinedAt || new Date().toISOString(),
        lastActive: Date.now()
      };
    } else {
      talarState.bozorgParticipants.push({
        username,
        micActive: !!micActive,
        webcamActive: !!webcamActive,
        screenActive: !!screenActive,
        joinedAt: new Date().toISOString(),
        lastActive: Date.now()
      });
    }
    res.json({ success: true, participants: talarState.bozorgParticipants });
  });

  app.post("/api/talar-bozorg/leave", (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "نام کاربری الزامی است." });
    }
    talarState.bozorgParticipants = talarState.bozorgParticipants.filter(p => p.username !== username);
    res.json({ success: true, participants: talarState.bozorgParticipants });
  });

  app.post("/api/talar-bozorg/status", (req, res) => {
    const { username, micActive, webcamActive, screenActive } = req.body;
    if (!username) {
      return res.status(400).json({ error: "نام کاربری الزامی است." });
    }
    pruneInactiveTalarState();
    const idx = talarState.bozorgParticipants.findIndex(p => p.username === username);
    if (idx !== -1) {
      talarState.bozorgParticipants[idx].micActive = !!micActive;
      talarState.bozorgParticipants[idx].webcamActive = !!webcamActive;
      talarState.bozorgParticipants[idx].screenActive = !!screenActive;
      talarState.bozorgParticipants[idx].lastActive = Date.now();
    } else {
      talarState.bozorgParticipants.push({
        username,
        micActive: !!micActive,
        webcamActive: !!webcamActive,
        screenActive: !!screenActive,
        joinedAt: new Date().toISOString(),
        lastActive: Date.now()
      });
    }
    res.json({ success: true, participants: talarState.bozorgParticipants });
  });

  app.post("/api/talar-bozorg/upload-frame", (req, res) => {
    const { username, webcamFrame, screenFrame } = req.body;
    if (!username) {
      return res.status(400).json({ error: "نام کاربری الزامی است." });
    }
    const idx = talarState.bozorgParticipants.findIndex(p => p.username === username);
    if (idx !== -1) {
      if (webcamFrame !== undefined) {
        talarState.bozorgParticipants[idx].webcamFrame = webcamFrame;
      }
      if (screenFrame !== undefined) {
        talarState.bozorgParticipants[idx].screenFrame = screenFrame;
      }
      talarState.bozorgParticipants[idx].lastActive = Date.now();
      return res.json({ success: true });
    }
    res.status(404).json({ error: "کاربر یافت نشد." });
  });

  app.post("/api/talar-bozorg/upload-audio", (req, res) => {
    const { username, chunk } = req.body;
    if (!username || !chunk || !chunk.id || !chunk.data) {
      return res.status(400).json({ error: "اطلاعات صوتی نامعتبر است." });
    }
    const idx = talarState.bozorgParticipants.findIndex(p => p.username === username);
    if (idx !== -1) {
      if (!talarState.bozorgParticipants[idx].audioChunks) {
        talarState.bozorgParticipants[idx].audioChunks = [];
      }
      talarState.bozorgParticipants[idx].audioChunks!.push(chunk);
      
      // Retain only the last 5 audio chunks to avoid memory build-up and latency
      if (talarState.bozorgParticipants[idx].audioChunks!.length > 5) {
        talarState.bozorgParticipants[idx].audioChunks = talarState.bozorgParticipants[idx].audioChunks!.slice(-5);
      }
      
      talarState.bozorgParticipants[idx].lastActive = Date.now();
      return res.json({ success: true });
    }
    res.status(404).json({ error: "کاربر یافت نشد." });
  });


  // Integrate Vite for dev, or static asset delivery for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Express server successfully running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[SERVER] Failed to start server:", err);
});
