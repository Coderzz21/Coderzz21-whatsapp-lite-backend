import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import fs from "fs";

const __dirname = path.resolve();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Users
const USERS = JSON.parse(fs.readFileSync("./users.json"));

// Messages persistence
const MESSAGES_FILE = "./messages.json";
let MESSAGES = [];
try {
  MESSAGES = JSON.parse(fs.readFileSync(MESSAGES_FILE));
} catch {
  MESSAGES = [];
}

// Login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const valid = USERS.find(
    (u) => u.username === username && u.password === password
  );
  valid ? res.json({ success: true }) : res.status(401).json({ success: false });
});

// Endpoint to fetch all messages (for page reload)
app.get("/messages", (req, res) => {
  res.json(MESSAGES);
});

// Socket.io
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("send_message", (data) => {
    // Create human-readable timestamp
    const timestamp = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const msg = { ...data, timestamp };

    // Save to messages
    MESSAGES.push(msg);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(MESSAGES, null, 2));

    // Broadcast to all clients
    io.emit("receive_message", msg);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
