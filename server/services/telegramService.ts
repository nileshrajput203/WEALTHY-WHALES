import axios from "axios";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendAlert(chatId: string, message: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn("[Telegram Service] TELEGRAM_BOT_TOKEN is not configured in .env. Alert skipped.");
    return false;
  }
  if (!chatId) {
    console.warn("[Telegram Service] No chatId provided. Alert skipped.");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    }, { timeout: 8000 });

    if (response.status === 200 && response.data?.ok) {
      console.log(`[Telegram Service] Alert sent successfully to chat: ${chatId}`);
      return true;
    }
    console.error("[Telegram Service] Send failed:", response.data);
    return false;
  } catch (error: any) {
    console.error("[Telegram Service] HTTP Error sending alert:", error.message);
    return false;
  }
}

export function formatSignalAlert(symbol: string, signal: string, confidence: number, price: number): string {
  const signalEmoji = signal.toUpperCase() === "BUY" ? "🟢" : signal.toUpperCase() === "SELL" ? "🔴" : "🟡";
  const confidenceColor = confidence >= 70 ? "Strong" : confidence >= 50 ? "Moderate" : "Weak";
  
  return `
<b>🤖 GenAI-Stock Indicator Signal Alert</b>

Stock: <b>${symbol.toUpperCase()}</b>
Action: ${signalEmoji} <b>${signal.toUpperCase()}</b>
Price: <b>₹${price.toLocaleString("en-IN")}</b>
Confidence: <b>${confidence}% (${confidenceColor})</b>

<i>Logged at: ${new Date().toLocaleTimeString("en-IN")}</i>
  `.trim();
}
