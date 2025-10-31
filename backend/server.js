import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

const __dirname = path.resolve();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ===== STATIC UPLOADS FOLDER =====
// Works both locally and on Render
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

// ===== USERS =====
const USERS_FILE = "./users.json";
const USERS = fs.existsSync(USERS_FILE)
  ? JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"))
  : [];

// ===== MESSAGES =====
const MESSAGES_FILE = "./messages.json";
let MESSAGES = [];
try {
  MESSAGES = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
} catch {
  MESSAGES = [];
}

// ===== LOGIN ROUTE =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const valid = USERS.find(
    (u) => u.username === username && u.password === password
  );
  valid
    ? res.json({ success: true })
    : res.status(401).json({ success: false });
});

// ===== GET ALL MESSAGES =====
app.get("/messages", (req, res) => {
  res.json(MESSAGES);
});

// ===== FILE UPLOAD SETUP =====
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// ===== DETECT BACKEND URL (auto switch between local and Render) =====
const getBackendURL = () => {
  // If hosted on Render, use Render domain; otherwise use localhost
  return process.env.RENDER_EXTERNAL_URL || "http://localhost:4000";
};

// ===== UPLOAD FILE ROUTE =====
app.post("/upload", upload.single("file"), (req, res) => {
  const backendURL = getBackendURL();
  const fileUrl = `${backendURL}/uploads/${req.file.filename}`;

  const now = new Date();
  const timestamp = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const msg = {
    type: "file",
    message: fileUrl,
    sender: "system",
    timestamp,
  };

  // Save message and broadcast
  MESSAGES.push(msg);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(MESSAGES, null, 2));
  io.emit("receive_message", msg);

  res.json({ url: fileUrl });
});

// ===== AUTO DELETE FILES OLDER THAN 1 HOUR =====
setInterval(() => {
  const now = Date.now();
  const files = fs.readdirSync(uploadDir);
  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > 60 * 60 * 1000) {
      fs.unlinkSync(filePath);
      console.log(`🧹 Deleted old file: ${file}`);
    }
  }
}, 10 * 60 * 1000);

// ===== SOCKET.IO (Realtime Chat) =====
io.on("connection", (socket) => {
  console.log("✅ New client connected");

  socket.on("send_message", (data) => {
    const now = new Date();
    const timestamp = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    const msg = { ...data, timestamp };
    MESSAGES.push(msg);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(MESSAGES, null, 2));
    io.emit("receive_message", msg);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}
📅 Local Time: ${new Date().toLocaleString("en-IN")}
🌐 URL: ${getBackendURL()}`
  );
});
