import { nanoid } from "nanoid";

export function registerSocketHandlers(
  io,
  rooms,
  getRandomTopic,
  generateQuestions
) {
  io.use((socket, next) => {
    const name = socket.handshake.auth?.name;
    if (!name) {
      return next(new Error("Name is required"));
    }
    socket.playerName = name;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`User connected with id ${socket.id}`);

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
        hostId: socket.id,
      });
      socket.join(roomId);
      const room = rooms.get(roomId);
      const player = {
        id: socket.id,
        name: socket.playerName,
        score: 0,
        status: "LOBBY",
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
      if (room.players.length === room.maxPlayers) {
        socket.emit("room-error", "Room is full");
        return;
      }
      socket.join(roomId);
      const player = {
        id: socket.id,
        name: socket.playerName,
        score: 0,
        status: room.status === "RUNNING" ? "INGAME" : "LOBBY",
      };
      room.players.push(player);
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
        status: player.status,
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
        io.to(roomId).emit("game-starting");
        const questions = await generateQuestions(room.topic, room.difficulty);
        room.questions = questions;
        room.status = "RUNNING";
        room.players.forEach((player) => {
          player.status = "INGAME";
        });
        io.to(roomId).emit("game-started", room);
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
          const player = room.players.find((player) => player.id === socket.id);
          player.score += 1;
          io.to(roomId).emit("answer-correct", room);
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
      room.players.find((player) => player.id === socket.id).status = "LOBBY";
      io.to(roomId).emit("player-finished", room);
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
      });
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
      const player = room.players.find((player) => player.id === socket.id);
      if (!player) {
        socket.emit("room-error", "Player not found in room");
        return;
      }
      const playerName = player.name;
      room.players = room.players.filter((player) => player.id !== socket.id);
      if (room.hostId === socket.id) {
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
          playerId: socket.id,
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
      const player = room.players.find((player) => player.id === socket.id);
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
      for (const [roomId, room] of rooms.entries()) {
        const wasInRoom = room.players.some(
          (player) => player.id === socket.id
        );
        if (wasInRoom) {
          const playerName = room.players.find(
            (player) => player.id === socket.id
          ).name;
          room.players = room.players.filter(
            (player) => player.id !== socket.id
          );
          // If host leaves, close room
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
}
