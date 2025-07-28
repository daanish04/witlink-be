import { ai } from "./config.js";

export async function generateQuestions(topic, difficulty) {
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
