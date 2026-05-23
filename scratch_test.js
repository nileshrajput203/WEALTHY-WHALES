import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

const geminiKey = process.env.GEMINI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;

console.log("Gemini Key:", geminiKey ? "Found" : "Missing");
console.log("Groq Key:", groqKey ? "Found" : "Missing");

async function testGemini() {
  if (!geminiKey) return;
  console.log("\nTesting Gemini...");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello, what is 2+2?",
      // config: { thinkingConfig: { thinkingBudget: 512 } } // Let's test if this is the issue
    });
    console.log("Gemini Success! Response:", res.text);
  } catch (err) {
    console.error("Gemini Failed:", err.message || err);
  }
}

async function testGeminiWithThinking() {
  if (!geminiKey) return;
  console.log("\nTesting Gemini with thinkingConfig...");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello, what is 2+2?",
      config: { thinkingConfig: { thinkingBudget: 512 } }
    });
    console.log("Gemini with Thinking Success! Response:", res.text);
  } catch (err) {
    console.error("Gemini with Thinking Failed:", err.message || err);
  }
}

async function testGroq() {
  if (!groqKey) return;
  console.log("\nTesting Groq...");
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Hello, what is 2+2?" }],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Groq Success! Response:", response.data?.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("Groq Failed:", err.message || err);
  }
}

(async () => {
  await testGemini();
  await testGeminiWithThinking();
  await testGroq();
})();
