import { nanoid } from "nanoid";

export function registerSocketHandlers(
  io,
  rooms,
  getRandomTopic,
  generateQuestions
) {
  // Strip non-serializable/internal fields before sending over the wire
  const sanitizeRoom = (room) => ({
    id: room.id,
    topic: room.topic,
    difficulty: room.difficulty,
    maxPlayers: room.maxPlayers,
    status: room.status,
    isPrivate: room.isPrivate,
    hostId: room.hostId,
    questions: room.questions,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      status: p.status,
      isOnline: p.isOnline,
      questionIndex: p.questionIndex ?? 0,
    })),
  });

  io.use((socket, next) => {
    const name = socket.handshake.auth?.name;
    const sessionId = socket.handshake.auth?.sessionId;
    if (!name) {
      return next(new Error("Name is required"));
    }
    if (!sessionId) {
      return next(new Error("Session ID is required"));
    }
    socket.playerName = name;
    socket.sessionId = sessionId;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`User connected — socketId: ${socket.id}, sessionId: ${socket.sessionId}`);

    // Create room (public/private)
    socket.on("make-room", ({ isPrivate = true }, callback) => {
      const roomId = nanoid(6);
      rooms.set(roomId, {
        id: roomId,
        topic: getRandomTopic(),
        difficulty: "EASY",
        maxPlayers: 5,
        players: [],
        status: "WAITING",
        isPrivate: !!isPrivate,
        hostId: socket.sessionId,
      });
      socket.join(roomId);
      const room = rooms.get(roomId);
      const player = {
        id: socket.sessionId,
        socketId: socket.id,
        name: socket.playerName,
        score: 0,
        status: "LOBBY",
        isOnline: true,
        questionIndex: 0,
      };
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

      // Reconnection: player with this sessionId is already in the room
      const existingPlayer = room.players.find((p) => p.id === socket.sessionId);
      if (existingPlayer) {
        // Cancel pending grace-period eviction
        if (existingPlayer.disconnectTimeout) {
          clearTimeout(existingPlayer.disconnectTimeout);
          delete existingPlayer.disconnectTimeout;
        }
        existingPlayer.socketId = socket.id;
        existingPlayer.isOnline = true;
        socket.join(roomId);
        // Bring the reconnected client up to speed
        socket.emit("room-joined", {
          ...sanitizeRoom(room),
          reconnectQuestionIndex: existingPlayer.questionIndex ?? 0,
        });
        io.to(roomId).emit("room-users", {
          roomId,
          host: room.hostId,
          players: sanitizeRoom(room).players,
        });
        // Emit player-joined so the SetGamePage redirect triggers for the reconnecting client
        io.to(roomId).emit("player-joined", {
          roomId,
          player: {
            id: existingPlayer.id,
            name: existingPlayer.name,
            score: existingPlayer.score,
            status: existingPlayer.status,
            isOnline: existingPlayer.isOnline,
            questionIndex: existingPlayer.questionIndex ?? 0,
          },
          players: sanitizeRoom(room).players,
        });
        console.log(`${socket.playerName} reconnected to room: ${roomId} at question ${existingPlayer.questionIndex ?? 0}`);
        return;
      }

      // New join
      if (room.players.length === room.maxPlayers) {
        socket.emit("room-error", "Room is full");
        return;
      }
      socket.join(roomId);
      const player = {
        id: socket.sessionId,
        socketId: socket.id,
        name: socket.playerName,
        score: 0,
        status: room.status === "RUNNING" ? "INGAME" : "LOBBY",
        isOnline: true,
        questionIndex: 0,
      };
      room.players.push(player);
      io.to(roomId).emit("player-joined", {
        roomId,
        player,
        players: sanitizeRoom(room).players,
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
        status: player.status,
        isOnline: player.isOnline,
      }));
      const myPlayer = room.players.find((p) => p.id === socket.sessionId);
      socket.emit("room-users", {
        roomId,
        host: room.hostId,
        players: sanitizeRoom(room).players,
      });
      socket.emit("room-joined", {
        ...sanitizeRoom(room),
        // Send back this player's own question index so QuestionsPage can resume
        reconnectQuestionIndex: myPlayer?.questionIndex ?? 0,
      });
    });

    // set room rules
    socket.on("room-update", (roomData) => {
      const roomId = roomData.id;
      if (!rooms.has(roomId)) {
        socket.emit("room-error", "Room does not exist");
        return;
      }
      const room = rooms.get(roomId);
      if (room.hostId !== socket.sessionId) {
        socket.emit("room-error", "Only the host can update room settings");
        return;
      }
      room.topic = roomData.topic;
      room.difficulty = roomData.difficulty;
      room.maxPlayers = roomData.maxPlayers;
      io.to(roomId).emit("room-saved", sanitizeRoom(room));
    });

    // start game
    socket.on("start-game", async (roomId) => {
      if (!rooms.has(roomId)) {
        socket.emit("room-error", "Room does not exist");
        return;
      }
      const room = rooms.get(roomId);
      if (room.hostId !== socket.sessionId) {
        socket.emit("room-error", "Only the host can update room settings");
        return;
      }
      try {
        io.to(roomId).emit("game-starting");
        const questions = await generateQuestions(room.topic, room.difficulty);
        room.questions = questions;
        room.status = "RUNNING";
        room.players.forEach((player) => {
          player.status = "INGAME";
          player.questionIndex = 0;
        });
        io.to(roomId).emit("game-started", sanitizeRoom(room));
      } catch (error) {
        console.error("Error generating questions:", error);
        socket.emit("room-error", "Failed to generate questions");
      }
    });

    // submitting answer
    socket.on(
      "submit-answer",
      ({ roomId, answer, correctAnswer, isCorrect }) => {
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
          const player = room.players.find((player) => player.id === socket.sessionId);
          if (player) {
            player.score += 1;
          }
          io.to(roomId).emit("answer-correct", sanitizeRoom(room));
        }
        // Always advance the player's question index on any answer submission
        const answeringPlayer = room.players.find((p) => p.id === socket.sessionId);
        if (answeringPlayer) {
          answeringPlayer.questionIndex = (answeringPlayer.questionIndex ?? 0) + 1;
        }
      }
    );

    // player finished game
    socket.on("player-finished", (roomId) => {
      if (!rooms.has(roomId)) {
        socket.emit("room-error", "Room does not exist");
        return;
      }
      const room = rooms.get(roomId);
      if (room.status !== "RUNNING") {
        socket.emit("room-error", "Game is not running");
        return;
      }
      const finishedPlayer = room.players.find((player) => player.id === socket.sessionId);
      if (finishedPlayer) finishedPlayer.status = "LOBBY";
      io.to(roomId).emit("player-finished", sanitizeRoom(room));
    });

    // game over and going back to the game page
    socket.on("game-over", (roomId) => {
      if (!rooms.has(roomId)) {
        socket.emit("room-error", "Room does not exist");
        return;
      }
      const room = rooms.get(roomId);
      room.status = "WAITING";
      room.players.forEach((player) => {
        player.status = "LOBBY";
        player.questionIndex = 0;
      });
      io.to(roomId).emit("back-to-room", sanitizeRoom(room));
      for (const player of room.players) {
        player.score = 0;
      }
    });

    // rename player
    socket.on("rename-player", (newName, callback) => {
      const trimmed = (newName || "").trim();
      if (!trimmed) {
        return callback?.("Name cannot be empty");
      }
      if (trimmed.length > 24) {
        return callback?.("Name must be 24 characters or fewer");
      }

      // Update the socket's own playerName so reconnects carry the new name
      socket.playerName = trimmed;

      // Update name in every room this session is part of and notify those rooms
      for (const [roomId, room] of rooms.entries()) {
        const player = room.players.find((p) => p.id === socket.sessionId);
        if (!player) continue;
        player.name = trimmed;
        io.to(roomId).emit("player-renamed", {
          playerId: socket.sessionId,
          newName: trimmed,
          players: sanitizeRoom(room).players,
        });
      }

      // Acknowledge success back to the caller (no error argument = success)
      callback?.();
    });


    socket.on("leave-room", (roomid) => {
      if (!rooms.has(roomid)) {
        socket.emit("room-error", "Room does not exist");
        return;
      }
      const room = rooms.get(roomid);
      const player = room.players.find((p) => p.id === socket.sessionId);
      if (!player) {
        socket.emit("room-error", "Player not found in room");
        return;
      }
      const playerName = player.name;
      // Cancel any pending grace timer
      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
      }
      room.players = room.players.filter((p) => p.id !== socket.sessionId);
      if (room.hostId === socket.sessionId) {
        io.to(roomid).emit("room-closed", {
          message: "Host has left. Room is closed.",
        });
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
      if (room.players.length === 0) {
        rooms.delete(roomid);
      } else {
        io.to(roomid).emit("room-left", {
          playerId: socket.sessionId,
          playerName,
          players: room.players,
        });
      }
    });

    socket.on("message", ({ roomId, message }) => {
      if (!rooms.has(roomId)) {
        socket.emit("room-error", "Room does not exist");
        return;
      }
      const room = rooms.get(roomId);
      const player = room.players.find((player) => player.id === socket.sessionId);
      if (!player) {
        socket.emit("room-error", "Player not found in room");
        return;
      }
      io.to(roomId).emit("message", {
        player: {
          id: player.id,
          name: player.name,
        },
        message,
      });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected — socketId: ${socket.id}, sessionId: ${socket.sessionId}`);

      for (const [roomId, room] of rooms.entries()) {
        // Only act on the player whose active socketId matches
        const player = room.players.find(
          (p) => p.id === socket.sessionId && p.socketId === socket.id
        );
        if (!player) continue;

        // Mark offline and notify room
        player.isOnline = false;
        io.to(roomId).emit("room-users", {
          roomId,
          host: room.hostId,
          players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: p.score,
            status: p.status,
            isOnline: p.isOnline,
          })),
        });

        // Start 30-second grace period before evicting
        player.disconnectTimeout = setTimeout(() => {
          console.log(`Grace period expired for ${player.name} in room ${roomId}`);
          room.players = room.players.filter((p) => p.id !== player.id);

          if (room.hostId === player.id) {
            io.to(roomId).emit("room-closed", {
              message: "Host disconnected and did not return. Room is closed.",
            });
            const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            for (const clientId of clients) {
              const clientSocket = io.sockets.sockets.get(clientId);
              if (clientSocket) clientSocket.leave(roomId);
            }
            rooms.delete(roomId);
          } else if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            io.to(roomId).emit("room-left", {
              playerId: player.id,
              playerName: player.name,
              players: room.players,
            });
          }
        }, 30000);
      }
    });
  });
}
