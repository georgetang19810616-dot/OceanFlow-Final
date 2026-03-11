import { GoogleGenerativeAI } from "@google/generative-ai";
import { Booking } from '../types';

// Safe initialization
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in process.env.API_KEY");
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
};


export const analyzeBookingData = async (bookings: Booking[]): Promise<string> => {
  const genAI = getAiClient();
  if (!genAI) return "Error: API Key is missing. Please configure the environment.";

  // Prepare a summary for the model
  const summary = bookings.map(b => 
    `- Ref: ${b.bookingRef}, Week: ${b.week}, Service: ${b.service}, POL: ${b.pol}, Client: ${b.client}, Type: ${b.type}`
  ).join('\n');

  const prompt = `
    You are a logistics expert analyzing shipping booking data.
    Here is the current list of confirmed bookings:
    ${summary}

    Please provide a concise analysis (max 150 words) covering:
    1. Volume trends by Week.
    2. Dominant Services or Clients.
    3. Any potential risks or suggestions based on common logistics knowledge (e.g., potential port congestion if many bookings are to the same POD in the same week).
  `;

  try {
    // 1. 首先获取模型实例
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-exp'  // 或使用 'gemini-1.5-flash' 如果 'gemini-2.5-flash' 不可用
      // generationConfig: { ... } // 可选配置
    });
    
    // 2. 使用正确的参数格式调用 generateContent
    // generateContent 期望的是一个字符串或特定的 content 结构
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // 3. 获取文本响应
    return response.text() || "No analysis generated.";
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate analysis. Please try again later.";
  }
};