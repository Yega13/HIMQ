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

// 'opening' = the very first discovery question. It's one call per path and the
// first impression, and it must obey the student's language exactly, so we route
// it to Sonnet (Haiku occasionally slips into another language on the richer
// opening prompt). 'chat' = ongoing discovery/teaching turns.
export type AIRole = 'plan' | 'chat' | 'opening';
export interface AIMessage { role: 'user' | 'assistant'; content: string; }

async function withClaude(messages: AIMessage[], role: AIRole, system: string, lang?: string): Promise<string> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not set');
  // Model routing: everything runs on Sonnet 5. Teaching quality is the core
  // product, and A/B testing showed Haiku misdiagnoses wrong answers (the exact
  // moment that matters most), while Sonnet nails them. English teaching used to
  // run on Haiku for cost; the credit meter caps per-user spend regardless of
  // model, so the quality win is worth it. `lang` is now unused for routing.
  void lang;
  const model = 'claude-sonnet-5';

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

  // Wrap in withTimeout too (not just the SDK's own timeout): with maxRetries a
  // hung Claude call could otherwise burn ~45s×retries and 504 the 60s route
  // BEFORE the Gemini fallback ever runs. This bounds the whole attempt so the
  // fallback still has time.
  const res = await withTimeout(anthropic.messages.create({
    model,
    max_tokens: role === 'plan' ? 8000 : 800,
    // Sonnet 5 runs adaptive thinking by default; disable it to keep chat fast
    // and stop hidden reasoning from eating the max_tokens budget. Haiku takes
    // no thinking param.
    ...(model === 'claude-sonnet-5' ? { thinking: { type: 'disabled' as const } } : {}),
    system,
    messages: apiMessages,
  }), role === 'plan' ? 58_000 : AI_TIMEOUT_MS); // big exam plans need longer
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
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: role === 'plan' ? 8000 : 800 } });
  const result = await withTimeout(chat.sendMessage(messages[messages.length - 1].content));
  return result.response.text();
}

// ── Streaming variants ──────────────────────────────────────────────────────
// Same model routing as the blocking path, but emit text deltas via onDelta as
// they arrive so the UI can render the reply progressively.

async function streamClaude(
  messages: AIMessage[], role: AIRole, system: string,
  onDelta: (t: string) => void, lang?: string,
): Promise<string> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not set');
  // All roles run on Sonnet 5 — see withClaude for the rationale. `lang` is
  // kept in the signature for the fallback path but no longer affects routing.
  void lang;
  const model = 'claude-sonnet-5';

  const apiMessages: Anthropic.MessageParam[] = messages.map((m, i) =>
    i === messages.length - 1
      ? { role: m.role, content: [{ type: 'text' as const, text: m.content, cache_control: { type: 'ephemeral' as const } }] }
      : { role: m.role, content: m.content }
  );

  const stream = anthropic.messages.stream({
    model,
    max_tokens: role === 'plan' ? 8000 : 800,
    ...(model === 'claude-sonnet-5' ? { thinking: { type: 'disabled' as const } } : {}),
    system,
    messages: apiMessages,
  });

  let full = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text;
      onDelta(event.delta.text);
    }
  }
  return full;
}

async function streamGemini(
  messages: AIMessage[], role: AIRole, system: string,
  onDelta: (t: string) => void,
): Promise<string> {
  if (!gemini) throw new Error('GEMINI_API_KEY not set');
  const modelName = role === 'plan' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
  const model = gemini.getGenerativeModel({ model: modelName, systemInstruction: system });
  const history = toGeminiHistory(messages);
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: role === 'plan' ? 8000 : 800 } });
  const result = await chat.sendMessageStream(messages[messages.length - 1].content);
  let full = '';
  for await (const chunk of result.stream) {
    const t = chunk.text();
    if (t) { full += t; onDelta(t); }
  }
  return full;
}

// Streams the reply, mirroring generateAIResponse's provider order and fallback.
// Critically: it only falls back to the other provider if the first one fails
// BEFORE emitting any token — a mid-stream failure re-throws so we never splice
// two partial responses together.
export async function streamAIResponse(
  messages: AIMessage[],
  role: AIRole,
  system: string,
  onDelta: (t: string) => void,
  modelId: ModelId = 'may1',
  lang?: string,
): Promise<string> {
  const unavailable = 'AI is temporarily unavailable. Please try again in a moment.';
  if (messages.length === 0) { onDelta(unavailable); return unavailable; }

  let started = false;
  const guard = (t: string) => { started = true; onDelta(t); };

  const order: ('claude' | 'gemini')[] = modelId === 'may1' ? ['claude', 'gemini'] : ['gemini', 'claude'];
  for (const provider of order) {
    if (provider === 'claude' && anthropic) {
      try { return await streamClaude(messages, role, system, guard, lang); }
      catch (e) { console.error('[stream] Claude failed:', e); if (started) throw e; }
    }
    if (provider === 'gemini' && gemini) {
      try { return await streamGemini(messages, role, system, guard); }
      catch (e) { console.error('[stream] Gemini failed:', e); if (started) throw e; }
    }
  }
  onDelta(unavailable);
  return unavailable;
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
    // May-1: Claude primary (Sonnet 5 for all roles), Gemini fallback
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
