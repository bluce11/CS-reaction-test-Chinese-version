
import { GoogleGenAI, Type } from "@google/genai";
import { CoachFeedback } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getCoachFeedback(ms: number, mode: string): Promise<CoachFeedback> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `玩家刚刚在 ${mode} 测试中获得了 ${ms}ms 的反应时间。
      请扮演一位专业的 Counter-Strike 电竞教练。
      根据这个成绩给出一个简短、有力、带点幽默或鼓励性的点评（最多 30 字）。
      点评必须使用中文。
      同时提供一个符合这个速度的中文“CS 风格段位名称”。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comment: { type: Type.STRING },
            rankName: { type: Type.STRING }
          },
          required: ["comment", "rankName"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Gemini Coaching Error:", error);
    return {
      comment: ms < 200 ? "这种反应速度！你简直就是人间自瞄挂。" : "还行，但我奶奶拉枪都比你快点。",
      rankName: ms < 200 ? "全球精英" : "白银 I"
    };
  }
}