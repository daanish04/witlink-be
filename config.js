import dotenv from "dotenv";
dotenv.config();

export const PORT = 8000;
export const SELF_URL = "https://witlink-be.onrender.com/health";
export const LOCAL_URL = "http://localhost:8000/health";

import { GoogleGenAI } from "@google/genai";
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
