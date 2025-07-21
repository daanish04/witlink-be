# WitLink Backend

This is the backend for **WitLink**, a real-time multiplayer quiz platform. Built with Node.js, Express, and Socket.io.

## Features

- **Room Management**: Create, join, and manage quiz rooms (public/private).
- **Player Management**: Track players, scores, and host status in each room.
- **Game Flow**:
  - Host sets topic, difficulty, and max players.
  - Game starts when host triggers.
  - Real-time question delivery and answer validation.
  - Automatic leaderboard and score reset after each game.
- **AI-Generated Questions**: Uses Google Gemini API to generate quiz questions on the fly based on topic and difficulty.
- **Socket.io Events**: Real-time communication for all game actions (room join/leave, game start, answer submission, etc).
- **REST API Endpoints**:
  - `GET /api/question?topic=...&difficulty=...` – Generate questions (for testing)
  - `GET /api/questions/:roomId` – Get questions for a specific room
  - `GET /topics` – List available quiz topics
- **CORS Enabled**: For cross-origin requests from frontend.
- **Environment Config**: Uses `.env` for sensitive keys (e.g., Gemini API key).

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the root with your Gemini API key:

   ```
   GEMINI_API_KEY=your_google_gemini_api_key
   ```

3. Start the server:

   ```bash
   npm run dev
   ```

   (or `npm start` for production)

4. The server runs on [http://localhost:8000](http://localhost:8000) by default.

## Scripts

- `npm run dev` – Start with nodemon (auto-reload)
- `npm start` – Start server

## Tech Stack

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Socket.io](https://socket.io/)
- [Google Gemini API](https://ai.google.dev/)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [nanoid](https://www.npmjs.com/package/nanoid)

## Notes

- All data is stored in-memory (no database). Restarting the server will reset all rooms and players.
- Make sure your API key is valid and has access to the Gemini model.
- Designed to be used with the WitLink frontend.
