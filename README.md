# 🔧 WitLink Backend

This is the backend for **WitLink**, a real-time multiplayer quiz platform. Built with Node.js, Express, Socket.io, and powered by Google Gemini AI for dynamic question generation.

---

## ✨ Features

### 🎮 Core Functionality

- **Room Management**: Create, join, and manage quiz rooms (public/private)
- **Player Management**: Track players, scores, and host status in each room
- **Real-time Communication**: Socket.io for instant game state synchronization
- **AI-Powered Questions**: Dynamic question generation using Google Gemini AI
- **Game Flow Control**: Host controls for game start, settings, and room management

### 🎯 Game Features

- **70+ Quiz Topics**: Comprehensive topic library from World Capitals to Programming
- **Multiple Difficulties**: Easy (30s), Medium (45s), Hard (60s) per question
- **Real-time Scoring**: Live score tracking and leaderboard updates
- **Host Privileges**: Only hosts can start games and manage room settings
- **Player States**: Track player status (LOBBY, INGAME, etc.)

### 🔌 Connection Resilience

- **Session-based Identity**: Players are identified by a persistent `sessionId`, so identity survives reconnections and tab refreshes
- **30-second Grace Period**: When a player disconnects, the server waits 30 seconds before evicting them. If they reconnect in time, they are seamlessly reinstated with their score and host status intact
- **Reconnection Support**: The `join-room` handler detects returning players by `sessionId`, cancels pending eviction timers, and restores their slot, reconnecting mid-game exactly where they left off.

### 🛠 Technical Features

- **Socket.io Events**: Real-time communication for all game actions
- **REST API Endpoints**: HTTP endpoints for question generation and room data
- **CORS Enabled**: Cross-origin requests support for frontend integration
- **Environment Configuration**: Secure API key management
- **Error Handling**: Comprehensive error handling and validation

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Google Gemini API key

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file in the root:

   ```env
   GEMINI_API_KEY=your_google_gemini_api_key
   PORT=8000
   ```

3. **Start the server**

   ```bash
   npm run dev
   ```

4. **Server will be running on**
   [http://localhost:8000](http://localhost:8000)

---

## 📁 Project Structure

```
server/
├── index.js              # Main server entry point
├── config.js             # Configuration and AI setup
├── socketHandlers.js     # Socket.io event handlers
├── questions.js          # AI question generation logic
├── topics.js             # Quiz topics library
├── routes.js             # REST API routes
├── rooms.js              # Room management utilities
└── package.json          # Dependencies
```

---

## 🛠 Available Scripts

- `npm run dev` – Start with nodemon (auto-reload on changes)
- `npm start` – Start production server

---

## 🎨 Tech Stack

### Core Technologies

- **[Node.js](https://nodejs.org/)** – JavaScript runtime
- **[Express](https://expressjs.com/)** – Web framework
- **[Socket.io](https://socket.io/)** – Real-time bidirectional communication
- **[Google Gemini AI](https://ai.google.dev/)** – AI-powered question generation

### Utilities

- **[dotenv](https://www.npmjs.com/package/dotenv)** – Environment variable management
- **[nanoid](https://www.npmjs.com/package/nanoid)** – Unique room/session ID generation
- **[cors](https://www.npmjs.com/package/cors)** – Cross-origin resource sharing

---

## 🔌 API Endpoints

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/questions/:roomId` | Get cached questions for a room |
| `GET` | `/api/question?topic=&difficulty=` | Generate questions ad-hoc (testing) |
| `GET` | `/topics` | List all available quiz topics |

### Socket.io Handshake Auth

Every socket connection must supply auth credentials:

```js
// Client side
io(url, {
  auth: {
    name: "PlayerName",   // Display name
    sessionId: "abc123"   // Persistent ID from localStorage
  }
})
```

The server middleware validates both fields and rejects connections missing either.

### Socket.io Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `make-room` | `{}`, callback `(roomId)` | Create a new room; receives `roomId` via ack |
| `join-room` | `roomId` | Join or **reconnect** to an existing room |
| `get-room-users` | `roomId` | Fetch current room state for the requesting player |
| `room-update` | `{ id, topic, difficulty, maxPlayers }` | Update room settings (host only) |
| `start-game` | `roomId` | Generate questions and start game (host only) |
| `submit-answer` | `{ roomId, answer, correctAnswer, isCorrect }` | Submit answer; advances `questionIndex` regardless of correctness |
| `player-finished` | `roomId` | Signal that the player has completed all questions |
| `game-over` | `roomId` | Reset room to lobby (host only; blocked while players are still INGAME) |
| `leave-room` | `roomId` | Intentionally leave (instant eviction, no grace period) |
| `rename-player` | `newName`, callback `(err?)` | Rename the player across all rooms; ack returns error string on failure |
| `message` | `{ roomId, message }` | Send chat message |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `room + reconnectQuestionIndex` | Full room state for the joining/reconnecting player |
| `room-users` | `{ roomId, host, players }` | Room player list update |
| `player-joined` | `{ roomId, player, players }` | A new player joined (also fired on reconnect to trigger redirect) |
| `room-left` | `{ playerId, playerName, players }` | A player intentionally left |
| `room-saved` | `room` | Room settings were updated |
| `game-starting` | — | AI is generating questions |
| `game-started` | `room` | Questions ready, game begins |
| `answer-correct` | `room` | Emitted when a correct answer is submitted (score updated) |
| `player-finished` | `room` | A player completed all questions |
| `player-renamed` | `{ playerId, newName, players }` | A player was renamed |
| `back-to-room` | `room` | Game over, returning to lobby |
| `room-closed` | `{ message }` | Room was closed (host left or grace period expired) |
| `room-error` | `errorString` | Operation failed |
| `message` | `{ player, message }` | Chat message broadcast |

---

## 🧠 AI Question Generation

### Features

- **Dynamic Topics**: 70+ predefined topics from various categories
- **Difficulty Levels**: Easy, Medium, Hard with appropriate timing
- **Structured Output**: JSON format with questions, options, and correct answers
- **Quality Control**: Validation and error handling for AI responses

### Question Format

```json
{
  "question": "Which planet is known as the 'Red Planet'?",
  "options": ["A) Venus", "B) Mars", "C) Jupiter", "D) Saturn"],
  "correctAnswer": "B"
}
```

---

## 🏗 Architecture

### Player Object Schema

```js
{
  id: "sessionId",       // Persistent — survives reconnects
  socketId: "socket.id", // Transient — changes on every connection
  name: "PlayerName",
  score: 0,
  status: "LOBBY" | "INGAME",
  isOnline: true,
  questionIndex: 0,      // Server-tracked progress through questions
  disconnectTimeout: ... // Internal only — never sent to clients
}
```

### Reconnection Flow

1. Player disconnects → marked `isOnline: false`, room is notified, 30s timer starts
2. If player reconnects within 30s via `join-room`:
   - Timer cancelled
   - `socketId` updated, `isOnline` set back to `true`
   - `room-joined` (with `reconnectQuestionIndex`), `room-users`, and `player-joined` emitted to sync state and trigger client redirect
3. If timer expires → player evicted; if host, room is closed

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🔗 Related Projects

- **[WitLink Frontend](https://github.com/daanish04/witlink-fe)** – Next.js frontend with real-time multiplayer features
