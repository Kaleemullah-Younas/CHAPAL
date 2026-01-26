import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
});

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Part[];
}

export async function* streamGeminiResponse(
  messages: ChatMessage[],
  systemPrompt?: string,
) {
  const chat = geminiModel.startChat({
    history: messages.slice(0, -1),
    systemInstruction: systemPrompt
      ? { role: 'user', parts: [{ text: systemPrompt }] }
      : undefined,
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessageStream(lastMessage.parts);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

export async function generateChatTitle(firstMessage: string): Promise<string> {
  const result = await geminiModel.generateContent(
    `Generate a very short title (max 5 words) for a chat that starts with this message. Return only the title, nothing else:\n\n"${firstMessage}"`,
  );
  return result.response.text().trim().slice(0, 50);
}

export function createImagePart(base64Data: string, mimeType: string): Part {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

export function createTextPart(text: string): Part {
  return { text };
}
