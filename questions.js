import { ai } from "./config.js";

export async function generateQuestions(topic, difficulty) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Generate 10 multiple-choice questions for a quiz.
    The topic is: ${topic}\nThe difficulty is: ${difficulty} (among the game choices of 'easy', 'medium', 'hard').
    Each question should have:
    1. A unique question text.
    2. Exactly four (4) distinct options (A, B, C, D).
    3. Only one correct answer among the options.
    
    Provide the output as a JSON array of objects, where each object represents a question.
    Each question object should have the following keys:
    - 'question': (string) The text of the question.
    - 'options': (array of strings) An array containing the four options.
    - 'correctAnswer': (string) The correct option (e.g., "A", "B", "C", "D").
    
    Example format for a sample question:
    {  
      "question": "Which planet is known as the 'Red Planet'?",
      "options": ["A) Venus", "B) Mars", "C) Jupiter", "D) Saturn"],
      "correctAnswer": "B"
    }
    Timing per question differs for each difficulty. 30 seconds for EASY. 45 seconds for MEDIUM. 60 seconds for HARD. So keep the questions and answers length set such that a player has enough time to read the question, understand it, think about it and answer.
    Options should not be very verbose. Short answers so players feel its an MCQ. Also, the options should be distinct and not too similar to avoid confusion. Make sure there are only four options and only one correct answer.
    Have correct answer diverse and not always a particular option. For example, if you are generating questions for a topic like 'History', the correct answer should not always be 'A'. It should be distributed evenly among A, B, C, and D options.
    Ensure the questions are challenging but fair for the specified difficulty level. Avoid ambiguity in questions or options. Do not write any introductory or concluding words. Just the JSON array of objects, otherwise the backend will fail.`,
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
