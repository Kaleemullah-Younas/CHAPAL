import {
  GoogleGenerativeAI,
  Part,
  GenerativeModel,
} from '@google/generative-ai';

// Parse comma-separated API keys from environment variable
const API_KEYS = (process.env.GEMINI_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

if (API_KEYS.length === 0) {
  console.warn(
    'No Gemini API keys found in GEMINI_API_KEY environment variable',
  );
}

// Key rotation manager
class GeminiKeyManager {
  private currentKeyIndex = 0;
  private clients: Map<string, GoogleGenerativeAI> = new Map();

  getCurrentKey(): string {
    return API_KEYS[this.currentKeyIndex] || '';
  }

  getClient(): GoogleGenerativeAI {
    const key = this.getCurrentKey();
    if (!this.clients.has(key)) {
      this.clients.set(key, new GoogleGenerativeAI(key));
    }
    return this.clients.get(key)!;
  }

  getModel(): GenerativeModel {
    return this.getClient().getGenerativeModel({
      model: 'gemini-3-flash-preview',
    });
  }

  rotateToNextKey(): boolean {
    if (this.currentKeyIndex < API_KEYS.length - 1) {
      this.currentKeyIndex++;
      console.log(
        `Rotating to API key ${this.currentKeyIndex + 1}/${API_KEYS.length}`,
      );
      return true;
    }
    return false; // No more keys available
  }

  resetKeyIndex(): void {
    this.currentKeyIndex = 0;
  }

  getTotalKeys(): number {
    return API_KEYS.length;
  }

  getCurrentKeyNumber(): number {
    return this.currentKeyIndex + 1;
  }
}

const keyManager = new GeminiKeyManager();

// Custom error for when all keys are exhausted
export class AllKeysExhaustedError extends Error {
  constructor() {
    super(
      'All Gemini API keys have been rate limited. Please try again later.',
    );
    this.name = 'AllKeysExhaustedError';
  }
}

// Helper to check if error is a 429 rate limit error
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('resource exhausted')
    );
  }
  return false;
}

// For backwards compatibility
export const geminiModel = keyManager.getModel();

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Part[];
}

export async function* streamGeminiResponse(
  messages: ChatMessage[],
  systemPrompt?: string,
): AsyncGenerator<string, void, unknown> {
  // Reset to first key at the start of a new request
  keyManager.resetKeyIndex();

  while (true) {
    try {
      const model = keyManager.getModel();
      const chat = model.startChat({
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
      return; // Success, exit the function
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(
          `Rate limit hit on API key ${keyManager.getCurrentKeyNumber()}/${keyManager.getTotalKeys()}`,
        );
        if (!keyManager.rotateToNextKey()) {
          throw new AllKeysExhaustedError();
        }
        // Continue to retry with next key
      } else {
        // Non-rate-limit error, rethrow
        throw error;
      }
    }
  }
}

export async function generateChatTitle(firstMessage: string): Promise<string> {
  // Reset to first key at the start of a new request
  keyManager.resetKeyIndex();

  while (true) {
    try {
      const model = keyManager.getModel();
      const result = await model.generateContent(
        `Generate a very short title (max 5 words) for a chat that starts with this message. Return only the title, nothing else:\n\n"${firstMessage}"`,
      );
      return result.response.text().trim().slice(0, 50);
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(
          `Rate limit hit on API key ${keyManager.getCurrentKeyNumber()}/${keyManager.getTotalKeys()}`,
        );
        if (!keyManager.rotateToNextKey()) {
          throw new AllKeysExhaustedError();
        }
        // Continue to retry with next key
      } else {
        // Non-rate-limit error, rethrow
        throw error;
      }
    }
  }
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
