// This module must only run server-side (API routes). It holds secret API keys.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai.ts must not be imported client-side');
}

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// SONNET: plan generation (high quality, infrequent)
// HAIKU:  chat messages (20x cheaper, fast)
const SONNET = 'claude-sonnet-4-6';
const HAIKU = 'claude-haiku-4-5-20251001';

export type AIRole = 'plan' | 'chat';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateWithClaude(
  messages: AIMessage[],
  role: AIRole,
  systemPrompt: string
): Promise<string> {
  const model = role === 'plan' ? SONNET : HAIKU;

  const response = await anthropic.messages.create({
    model,
    max_tokens: role === 'plan' ? 2000 : 800,
    system: systemPrompt,
    messages,
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text;
}

export async function generateWithGemini(
  messages: AIMessage[],
  systemPrompt: string
): Promise<string> {
  if (messages.length === 0) throw new Error('messages array must not be empty');

  const model = gemini.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1].content;

  const chat = model.startChat({
    history,
    generationConfig: { maxOutputTokens: 800 },
  });

  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}

const DEMO_FALLBACK_RESPONSE =
  'I am your EduPath AI teacher. It looks like I am having trouble connecting right now. Please try again in a moment, or reload the page.';

export async function generateAIResponse(
  messages: AIMessage[],
  role: AIRole,
  systemPrompt: string
): Promise<string> {
  if (messages.length === 0) return DEMO_FALLBACK_RESPONSE;

  try {
    return await generateWithClaude(messages, role, systemPrompt);
  } catch (claudeErr) {
    console.error('Claude failed, trying Gemini:', claudeErr);
  }

  try {
    return await generateWithGemini(messages, systemPrompt);
  } catch (geminiErr) {
    console.error('Gemini also failed:', geminiErr);
  }

  return DEMO_FALLBACK_RESPONSE;
}
