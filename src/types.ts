export interface User {
  id: string;
  username: string;
  role: "admin" | "user";
  status: "pending" | "approved" | "rejected";
  avatarUrl?: string;
  nickname?: string;
  bio?: string;
}

export interface LiveStreamStatus {
  isLive: boolean;
  streamer: string;
  title: string;
  streamType: "webcam" | "url";
  streamUrl?: string;
  startedAt?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  type: "stream" | "stream2" | "times" | "bozorgan";
  createdAt: string;
  replyToId?: string;
  replyToUser?: string;
  replyToText?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Post {
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
  likes: string[];
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  uploader: string;
  description: string;
  downloadUrl: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  text: string;
  author: string;
  submittedBy: string;
  createdAt: string;
}

export interface SharedGif {
  id: string;
  url: string;
  name: string;
  addedBy: string;
  createdAt: string;
}

export interface TalarBozorgParticipant {
  username: string;
  micActive: boolean;
  webcamActive: boolean;
  screenActive: boolean;
  joinedAt: string;
  webcamFrame?: string | null;
  screenFrame?: string | null;
  audioChunks?: { id: string; data: string; timestamp: number }[];
}


