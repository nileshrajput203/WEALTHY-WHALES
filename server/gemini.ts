// Gemini AI integration - referenced from javascript_gemini blueprint
import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getFinancialAdvice(userQuery: string, stockContext?: string): Promise<string> {
  try {
    const systemPrompt = `You are a professional financial advisor specializing in the Indian stock market (NSE and BSE). 
Provide accurate, helpful advice about stocks, market trends, and investment strategies. 
Always include relevant disclaimers about investment risks.
Keep responses concise and informative.
${stockContext ? `Context: The user is asking about ${stockContext}` : ''}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: userQuery,
    });

    return response.text || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to get AI response");
  }
}
