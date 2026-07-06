// Server-side only
if (typeof window !== 'undefined') {
  throw new Error('lib/ai.ts must not be imported client-side');
}

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { type ModelId } from './models';

const AI_TIMEOUT_MS = 45_000;

const anthropic: Anthropic | null = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 2 })
  : null;

// Reject a hung provider call so we can fall back instead of blocking until
// the serverless function times out.
function withTimeout<T>(p: Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI request timed out')), ms)),
  ]);
}

const gemini: GoogleGenerativeAI | null = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

if (!anthropic && !gemini) {
  throw new Error('Configure at least one of ANTHROPIC_API_KEY or GEMINI_API_KEY');
}

export type AIRole = 'plan' | 'chat';
export interface AIMessage { role: 'user' | 'assistant'; content: string; }

async function withClaude(messages: AIMessage[], role: AIRole, system: string, lang?: string): Promise<string> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not set');
  // Model routing to balance cost and quality:
  // - Plan generation: always Sonnet 5 (once per path, quality-critical).
  // - Chat in English: Haiku 4.5 (plenty good, ~3x cheaper).
  // - Chat in Armenian/Russian: Sonnet 5 (Haiku's low-resource-language quality
  //   is poor). Default non-'en' to Sonnet to be safe on quality.
  const model = role === 'plan'
    ? 'claude-sonnet-5'
    : (lang === 'en' ? 'claude-haiku-4-5' : 'claude-sonnet-5');

  // Prompt caching: mark the last message as a cache breakpoint. The API caches
  // everything before it (system prompt + prior conversation) and, on the next
  // turn within ~5 min, reads that prefix at ~10% of the input price instead of
  // re-billing it in full. Caching is transparent — if a prefix is too short or
  // the cache expired, it simply costs the normal price; responses are identical.
  const apiMessages: Anthropic.MessageParam[] = messages.map((m, i) =>
    i === messages.length - 1
      ? { role: m.role, content: [{ type: 'text' as const, text: m.content, cache_control: { type: 'ephemeral' as const } }] }
      : { role: m.role, content: m.content }
  );

  const res = await anthropic.messages.create({
    model,
    max_tokens: role === 'plan' ? 2000 : 800,
    // Sonnet 5 runs adaptive thinking by default; disable it to keep chat fast
    // and stop hidden reasoning from eating the max_tokens budget. Haiku takes
    // no thinking param.
    ...(model === 'claude-sonnet-5' ? { thinking: { type: 'disabled' as const } } : {}),
    system,
    messages: apiMessages,
  });
  const block = res.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');
  return block.text;
}

// Gemini requires history to START with a 'user' turn and strictly ALTERNATE
// user/model. Our chats open with an assistant message, so a naive map throws
// ("First content should be with role 'user'"). Drop leading model turns and
// merge consecutive same-role turns.
function toGeminiHistory(messages: AIMessage[]) {
  const mapped = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  while (mapped.length && mapped[0].role === 'model') mapped.shift();
  const out: typeof mapped = [];
  for (const turn of mapped) {
    const last = out[out.length - 1];
    if (last && last.role === turn.role) last.parts[0].text += '\n\n' + turn.parts[0].text;
    else out.push(turn);
  }
  return out;
}

async function withGemini(messages: AIMessage[], role: AIRole, system: string): Promise<string> {
  if (!gemini) throw new Error('GEMINI_API_KEY not set');
  const modelName = role === 'plan' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
  const model = gemini.getGenerativeModel({ model: modelName, systemInstruction: system });
  const history = toGeminiHistory(messages);
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: role === 'plan' ? 2000 : 800 } });
  const result = await withTimeout(chat.sendMessage(messages[messages.length - 1].content));
  return result.response.text();
}

export async function generateAIResponse(
  messages: AIMessage[],
  role: AIRole,
  system: string,
  modelId: ModelId = 'may1',
  lang?: string
): Promise<string> {
  if (messages.length === 0) return 'AI is temporarily unavailable. Please try again.';

  if (modelId === 'may1') {
    // May-1: Claude primary (Haiku for EN chat, Sonnet otherwise), Gemini fallback
    if (anthropic) {
      try { return await withClaude(messages, role, system, lang); }
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
      try { return await withClaude(messages, role, system, lang); }
      catch (e) { console.error('[Gemini fallback] May-1 also failed:', e); }
    }
  }

  return 'AI is temporarily unavailable. Please try again in a moment.';
}
