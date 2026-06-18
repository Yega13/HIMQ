// Server-side only
if (typeof window !== 'undefined') {
  throw new Error('lib/ai.ts must not be imported client-side');
}

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { type ModelId } from './models';

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
  messages: AIMessage[],
  role: AIRole,
  system: string,
  modelId: ModelId = 'may1'
): Promise<string> {
  if (messages.length === 0) return 'AI is temporarily unavailable. Please try again.';

  if (modelId === 'may1') {
    // May-1: Claude primary, Gemini fallback
    if (anthropic) {
      try { return await withClaude(messages, role, system); }
      catch (e) { console.error('[May-1] Claude failed, falling back to Gemini:', e); }
    }
    if (gemini) {
      try { return await withGemini(messages, role, system); }
      catch (e) { console.error('[May-1 fallback] Gemini also failed:', e); }
    }
  } else {
    // Gemini: Gemini primary, May-1 fallback
    if (gemini) {
      try { return await withGemini(messages, role, system); }
      catch (e) { console.error('[Gemini] failed, falling back to May-1:', e); }
    }
    if (anthropic) {
      try { return await withClaude(messages, role, system); }
      catch (e) { console.error('[Gemini fallback] May-1 also failed:', e); }
    }
  }

  return 'AI is temporarily unavailable. Please try again in a moment.';
}
