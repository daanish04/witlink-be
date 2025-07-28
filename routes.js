export function registerRoutes(app, topics, generateQuestions, rooms) {
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

  app.get("/api/questions/:roomId", (req, res) => {
    const { roomId } = req.params;
    if (!rooms.has(roomId)) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = rooms.get(roomId);
    if (!room.questions) {
      return res
        .status(404)
        .json({ error: "Questions not found for this room" });
    }
    res.json({ questions: room.questions });
  });

  app.get("/topics", (req, res) => {
    res.json(topics);
  });

  app.get("/", (req, res) => {
    res.send("WitLink backend is running!");
  });

  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });
}
