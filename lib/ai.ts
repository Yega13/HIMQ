// Server-side only
if (typeof window !== 'undefined') {
  throw new Error('lib/ai.ts must not be imported client-side');
}

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Claude is PRIMARY. Gemini is fallback.
// Both are optional individually but at least one must be present.
const anthropic: Anthropic | null = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const gemini: GoogleGenerativeAI | null = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

if (!anthropic && !gemini) {
  throw new Error('Configure at least one of ANTHROPIC_API_KEY or GEMINI_API_KEY');
}

export type AIRole = 'plan' | 'chat';
export interface AIMessage { role: 'user' | 'assistant'; content: string; }

async function withClaude(messages: AIMessage[], role: AIRole, system: string): Promise<string> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not set');
  const model = role === 'plan' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
  const res = await anthropic.messages.create({
    model, max_tokens: role === 'plan' ? 2000 : 800, system, messages,
  });
  const block = res.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');
  return block.text;
}

async function withGemini(messages: AIMessage[], role: AIRole, system: string): Promise<string> {
  if (!gemini) throw new Error('GEMINI_API_KEY not set');
  const modelName = role === 'plan' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
  const model = gemini.getGenerativeModel({ model: modelName, systemInstruction: system });
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: role === 'plan' ? 2000 : 800 } });
  const result = await chat.sendMessage(messages[messages.length - 1].content);
  return result.response.text();
}

export async function generateAIResponse(
  messages: AIMessage[], role: AIRole, system: string
): Promise<string> {
  if (messages.length === 0) return 'AI is temporarily unavailable. Please try again.';

  // 1. Claude (primary)
  if (anthropic) {
    try { return await withClaude(messages, role, system); }
    catch (e) { console.error('[AI] Claude failed, trying Gemini:', e); }
  }

  // 2. Gemini (fallback)
  if (gemini) {
    try { return await withGemini(messages, role, system); }
    catch (e) { console.error('[AI] Gemini also failed:', e); }
  }

  return 'AI is temporarily unavailable. Please try again in a moment.';
}
