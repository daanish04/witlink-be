import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PORT, SELF_URL } from "./config.js";
import { topics, getRandomTopic } from "./topics.js";
import { generateQuestions } from "./questions.js";
import { rooms } from "./rooms.js";
import { registerSocketHandlers } from "./socketHandlers.js";
import { registerRoutes } from "./routes.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

app.use(express.json());
app.use(cors());

registerSocketHandlers(io, rooms, getRandomTopic, generateQuestions);
registerRoutes(app, topics, generateQuestions, rooms);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Self pinging for health check
setInterval(() => {
  fetch(SELF_URL)
    .then((res) => {
      if (res.ok) {
        console.log(`Self-ping at ${new Date()}`);
      } else {
        console.error(`Self-ping failed with status ${res.status}`);
      }
    })
    .catch((err) => {
      console.error(`Self-ping error:`, err.message);
    });
}, 13 * 60 * 1000);
