import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase';
import { streamAIResponse } from '@/lib/ai';
import { languageName } from '@/lib/utils';

// Public, UNAUTHENTICATED taste-test: a logged-out visitor types a goal and
// watches May stream a short plan. Because there's no account, it is a real
// paid AI call open to the internet — so it is strictly IP-rate-limited and
// fails CLOSED (a limiter outage blocks rather than allows) to protect spend.
export const config = { maxDuration: 30 };

const DAILY_IP_LIMIT = 5;
const MAX_GOAL = 200;
// Static salt so stored hashes aren't reversible rainbow-table lookups. Not a
// secret that needs rotating — it only anonymises IPs at rest.
const IP_SALT = 'himq-sample-v1';

function clientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : (xff ?? '').split(',')[0].trim();
  return raw || (req.headers['x-real-ip'] as string) || req.socket.remoteAddress || 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { goal, lang } = req.body as { goal?: string; lang?: string };
  const trimmedGoal = (goal ?? '').trim();
  if (!trimmedGoal || trimmedGoal.length > MAX_GOAL) {
    return res.status(400).json({ error: 'A goal under 200 characters is required' });
  }

  // Per-IP daily cap. Fails closed: if the limiter can't run, block (this
  // endpoint spends money and is unauthenticated).
  const ipHash = crypto.createHash('sha256').update(IP_SALT + clientIp(req)).digest('hex');
  const admin = getAdminClient();
  const { data: quota, error: quotaErr } = await admin
    .rpc('consume_sample', { p_ip: ipHash, p_limit: DAILY_IP_LIMIT });
  if (quotaErr) {
    console.error('Sample limiter unavailable (failing closed):', quotaErr);
    return res.status(503).json({ error: 'Try-it is warming up — please try again shortly.' });
  }
  if (!quota?.allowed) {
    return res.status(429).json({ error: "You've used today's free previews. Sign up to keep going — it's free." });
  }

  const language = languageName(lang);
  const system = `You are May, a warm expert tutor at HIMQ. Create a concise, motivating learning plan for the student's goal. Output ONLY a numbered list of 4–6 specific, concrete lesson titles — one per line — written in ${language}. Each title should be specific to the goal, not generic. No introduction, no closing remarks, no commentary — just the numbered lessons.`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    await streamAIResponse(
      [{ role: 'user', content: `The student wants to learn: "${trimmedGoal}".` }],
      'chat',
      system,
      (delta) => send({ delta }),
      'may1',
      lang,
    );
  } catch (err) {
    console.error('Sample plan stream failed:', err);
  }
  send({ done: true });
  res.end();
}
