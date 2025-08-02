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
- **[nanoid](https://www.npmjs.com/package/nanoid)** – Unique ID generation
- **[cors](https://www.npmjs.com/package/cors)** – Cross-origin resource sharing

---

## 🔌 API Endpoints

### REST Endpoints

- `GET /api/questions/:roomId` – Get questions for a specific room
- `GET /api/question?topic=...&difficulty=...` – Generate questions (testing)
- `GET /topics` – List available quiz topics

### Socket.io Events

#### Client to Server

- `make-room` – Create a new room
- `join-room` – Join an existing room
- `get-room-users` – Get room players and host
- `room-update` – Update room settings (host only)
- `start-game` – Start the quiz (host only)
- `submit-answer` – Submit answer to current question
- `player-finished` – Player completed the game
- `game-over` – End game and return to lobby (host only)
- `leave-room` – Leave the current room
- `message` – Send chat message

#### Server to Client

- `room-joined` – Confirmation of room join
- `room-users` – Room players and host information
- `player-joined` – New player joined notification
- `room-left` – Player left notification
- `room-saved` – Room settings updated
- `game-starting` – Game is about to start
- `game-started` – Game has started
- `answer-correct` – Answer validation result
- `player-finished` – Player completed game
- `back-to-room` – Return to lobby
- `room-closed` – Room has been closed
- `room-error` – Error notification
- `message` – Chat message received

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

### Room Management

- **In-Memory Storage**: Rooms stored in Map for fast access
- **Player Tracking**: Real-time player state management
- **Host Control**: Host privileges and room ownership
- **Auto-Cleanup**: Automatic room cleanup on host disconnect

### Socket.io Implementation

- **Authentication**: Player name-based authentication
- **Room Joining**: Automatic room assignment and player tracking
- **Event Handling**: Comprehensive event handling for all game actions
- **Error Recovery**: Graceful error handling and recovery

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🔗 Related Projects

- **[WitLink Frontend](https://github.com/yourusername/witLink-frontend)** – Next.js frontend with real-time multiplayer features

---
