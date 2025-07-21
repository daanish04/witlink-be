import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { nanoid } from "nanoid";
dotenv.config();

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to generate questions using Gemini
async function generateQuestions(topic, difficulty) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Generate 10 multiple-choice questions for a quiz.\nThe topic is: ${topic}\nThe difficulty is: ${difficulty} (among the game choices of 'easy', 'medium', 'hard')\n\nEach question should have:\n1.  A unique question text.\n2.  Exactly four (4) distinct options (A, B, C, D).\n3.  Only one correct answer among the options.\n\nProvide the output as a JSON array of objects, where each object represents a question.\nEach question object should have the following keys:\n-   'question': (string) The text of the question.\n-   'options': (array of strings) An array containing the four options.\n-   'correctAnswer': (string) The correct option (e.g., \"A\", \"B\", \"C\", \"D\").\n\nExample format for a sample question:\n{\n  \"question\": \"Which planet is known as the 'Red Planet'?\",\n  \"options\": [\"A) Venus\", \"B) Mars\", \"C) Jupiter\", \"D) Saturn\"],\n  \"correctAnswer\": \"B\"\n}\n\nTiming per question differs for each difficulty. 30 seconds for EASY. 45 seconds for MEDIUM. 60 seconds for HARD. So keep the questions and answers length set such that a player has enough time to read the question, understand it, think about it and answer.\nOptions should not be very verbose. Short answers so players feel its an MCQ.\nEnsure the questions are challenging but fair for the specified difficulty level.\nAvoid ambiguity in questions or options. Do not write any introductory or concluding words. Just the JSON array of objects, otherwise the backend will fail`,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
  const responseText = response.candidates[0].content.parts[0].text;
  let questions;
  try {
    questions = JSON.parse(responseText);
  } catch (parseError) {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      questions = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse questions from AI response");
    }
  }
  return questions;
}

const PORT = 8000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory data stores
const topics = [
  { name: "History of Artificial Intelligence" },
  { name: "Basic Calculus" },
  { name: "World Geography" },
  { name: "Cooking Techniques" },
  { name: "Modern Art" },
  { name: "Quantum Physics" },
  { name: "Classic Literature" },
  { name: "Computer Programming" },
];

// roomId: { id, name, isPrivate, players: [ { id, name, score } ], status, hostId }
const rooms = new Map();

io.use((socket, next) => {
  const name = socket.handshake.auth?.name;
  if (!name) {
    return next(new Error("Name is required"));
  }
  socket.playerName = name;
  next();
});

app.use(express.json());
app.use(cors());

io.on("connection", (socket) => {
  console.log(`User connected with id ${socket.id}`);

  // Create room (public/private)
  socket.on("make-room", ({ isPrivate = true }, callback) => {
    const roomId = nanoid(6);
    rooms.set(roomId, {
      id: roomId,
      topic: "",
      difficulty: "EASY",
      maxPlayers: 5,
      players: [],
      status: "WAITING",
      isPrivate: !!isPrivate,
      hostId: socket.id,
    });
    socket.join(roomId);
    const room = rooms.get(roomId);
    const player = { id: socket.id, name: socket.playerName, score: 0 };
    room.players.push(player);
    console.log(`${socket.playerName} made and joined room: ${roomId}`);

    if (callback) {
      callback(roomId);
    }
  });

  // Join room
  socket.on("join-room", (roomId) => {
    if (!rooms.has(roomId)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomId);
    if (room.players.length === room.maxPlayers) {
      socket.emit("room-error", "Room is full");
      return;
    }
    socket.join(roomId);
    const player = { id: socket.id, name: socket.playerName, score: 0 };
    room.players.push(player);
    // inform other users in the room
    io.to(roomId).emit("player-joined", {
      roomId,
      player,
      players: room.players,
    });
    console.log(`${socket.playerName} joined room: ${roomId}`);
  });

  // get users in room
  socket.on("get-room-users", (roomId) => {
    if (!rooms.has(roomId)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomId);
    const players = room.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
    }));
    socket.emit("room-users", {
      roomId,
      host: room.hostId,
      players,
    });
    socket.emit("room-joined", room);
  });

  // set room rules
  socket.on("room-update", (roomData) => {
    const roomId = roomData.id;
    if (!rooms.has(roomId)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomId);
    if (room.hostId !== socket.id) {
      socket.emit("room-error", "Only the host can update room settings");
      return;
    }
    room.topic = roomData.topic;
    room.difficulty = roomData.difficulty;
    room.maxPlayers = roomData.maxPlayers;
    io.to(roomId).emit("room-saved", room);
  });

  // start game
  socket.on("start-game", async (roomId) => {
    if (!rooms.has(roomId)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomId);
    if (room.hostId !== socket.id) {
      socket.emit("room-error", "Only the host can update room settings");
      return;
    }
    try {
      const questions = await generateQuestions(room.topic, room.difficulty);
      room.questions = questions;
      room.status = "RUNNING";
      io.to(roomId).emit("game-started", room);
    } catch (error) {
      console.error("Error generating questions:", error);
      socket.emit("room-error", "Failed to generate questions");
    }
  });

  // submitting answer
  socket.on("submit-answer", ({ roomId, answer, correctAnswer, isCorrect }) => {
    if (!rooms.has(roomId)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomId);
    if (room.status !== "RUNNING") {
      socket.emit("room-error", "Game is not running");
      return;
    }
    if (isCorrect) {
      const player = room.players.find((player) => player.id === socket.id);
      player.score += 1;
      // if correct, inform everyone in the room
      io.to(roomId).emit("answer-correct", room);
    }
  });

  // game over and going back to the game page
  socket.on("game-over", (roomId) => {
    if (!rooms.has(roomId)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomId);
    room.status = "WAITING";
    io.to(roomId).emit("back-to-room", room);
    for (const player of room.players) {
      player.score = 0;
    }
  });

  // leave room
  socket.on("leave-room", (roomid) => {
    if (!rooms.has(roomid)) {
      socket.emit("room-error", "Room does not exist");
      return;
    }
    const room = rooms.get(roomid);
    // Remove the player from the room
    const playerName = room.players.find(
      (player) => player.id === socket.id
    ).name;
    room.players = room.players.filter((player) => player.id !== socket.id);
    // If the host leaves, close the room for everyone
    if (room.hostId === socket.id) {
      // Notify all remaining players
      io.to(roomid).emit("room-closed", {
        message: "Host has left. Room is closed.",
      });
      // Disconnect all sockets in the room
      const clients = Array.from(io.sockets.adapter.rooms.get(roomid) || []);
      for (const clientId of clients) {
        const clientSocket = io.sockets.sockets.get(clientId);
        if (clientSocket) {
          clientSocket.leave(roomid);
        }
      }
      rooms.delete(roomid);
      return;
    }
    // If room is empty after this player leaves, delete the room
    if (room.players.length === 0) {
      rooms.delete(roomid);
    } else {
      io.to(roomid).emit("room-left", {
        playerId: socket.id,
        playerName,
        players: room.players,
      });
    }
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms.entries()) {
      const wasInRoom = room.players.some((player) => player.id === socket.id);
      if (wasInRoom) {
        const playerName = room.players.find(
          (player) => player.id === socket.id
        ).name;
        room.players = room.players.filter((player) => player.id !== socket.id);
        // If the host leaves, close the room for everyone
        if (room.hostId === socket.id) {
          io.to(roomId).emit("room-closed", {
            message: "Host has left. Room is closed.",
          });
          const clients = Array.from(
            io.sockets.adapter.rooms.get(roomId) || []
          );
          for (const clientId of clients) {
            const clientSocket = io.sockets.sockets.get(clientId);
            if (clientSocket) {
              clientSocket.leave(roomId);
            }
          }
          rooms.delete(roomId);
          continue;
        }
        // If room is empty after this player leaves, delete the room
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit("room-left", {
            playerId: socket.id,
            playerName,
            players: room.players,
          });
        }
      }
    }
    console.log(`User disconnected with id ${socket.id}`);
  });
});

app.get("/api/question", async (req, res) => {
  try {
    const { topic, difficulty } = req.query;
    if (!topic || !difficulty) {
      return res
        .status(400)
        .json({ error: "Topic and difficulty are required" });
    }
    const questions = await generateQuestions(topic, difficulty);
    res.json({ questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// Add a new endpoint to get questions for a room
app.get("/api/questions/:roomId", (req, res) => {
  const { roomId } = req.params;
  if (!rooms.has(roomId)) {
    return res.status(404).json({ error: "Room not found" });
  }
  const room = rooms.get(roomId);
  if (!room.questions) {
    return res.status(404).json({ error: "Questions not found for this room" });
  }
  res.json({ questions: room.questions });
});

// Topics endpoint
app.get("/topics", (req, res) => {
  res.json(topics);
});

app.get("/", (req, res) => {
  res.send("WitLink backend is running!");
});
// main();

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
