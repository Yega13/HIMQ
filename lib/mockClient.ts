/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/* ────────────────────────────────────────────────────────────────────────
   Local development mock of the Supabase client.

   Activated automatically by lib/supabase.ts when no real Supabase project is
   configured (placeholder env vars). It lets sign-up / sign-in and the whole
   signed-in UI work entirely on the client via localStorage — NO backend
   required. On the server (SSR) it uses an in-memory seeded store.

   In production with real Supabase keys, this file is never imported/used.
   ──────────────────────────────────────────────────────────────────────── */

type Row = Record<string, any>;
type DB = Record<string, Row[]>;
type Session = { user: MockUser } | null;
type AuthCallback = (event: string, session: any) => void;

interface MockUser {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
  aud: string;
  created_at: string;
}

const DB_KEY = 'ep_mock_db';
const USERS_KEY = 'ep_mock_users';
const SESSION_KEY = 'ep_mock_session';

const isBrowser = () => typeof window !== 'undefined';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ── Seed data (so the demo isn't empty) ──────────────────────────────── */
function seedDB(): DB {
  const day = 86_400_000;
  const inDays = (n: number) => new Date(Date.now() + n * day).toISOString();
  const ago = (n: number) => new Date(Date.now() - n * day).toISOString();

  return {
    profiles: [
      { id: 'seed-1', full_name: 'Ani Sargsyan',   username: 'ani',   bio: null, goal: 'Master web development', skill_level: 'advanced',     preferred_language: 'am', xp: 1240, streak_days: 28, created_at: ago(120), email: 'ani@example.com' },
      { id: 'seed-2', full_name: 'Davit Petrosyan', username: 'davo',  bio: null, goal: 'Get into MIT',           skill_level: 'advanced',     preferred_language: 'en', xp: 1080, streak_days: 19, created_at: ago(110), email: 'davit@example.com' },
      { id: 'seed-3', full_name: 'Mariam Hakobyan', username: 'mary',  bio: null, goal: 'Learn data science',     skill_level: 'intermediate', preferred_language: 'am', xp: 940,  streak_days: 22, created_at: ago(95),  email: 'mariam@example.com' },
      { id: 'seed-4', full_name: 'Tigran Avetisyan',username: 'tig',   bio: null, goal: 'Python & AI',            skill_level: 'intermediate', preferred_language: 'am', xp: 760,  streak_days: 11, created_at: ago(80),  email: 'tigran@example.com' },
      { id: 'seed-5', full_name: 'Nare Grigoryan',  username: 'nare',  bio: null, goal: 'IELTS 8.0',              skill_level: 'beginner',     preferred_language: 'en', xp: 610,  streak_days: 9,  created_at: ago(60),  email: 'nare@example.com' },
      { id: 'seed-6', full_name: 'Hayk Mkrtchyan',  username: 'hayk',  bio: null, goal: 'Marketing skills',       skill_level: 'beginner',     preferred_language: 'am', xp: 430,  streak_days: 5,  created_at: ago(40),  email: 'hayk@example.com' },
      { id: 'seed-7', full_name: 'Lilit Khachatryan',username: 'lilit',bio: null, goal: 'UI/UX design',           skill_level: 'intermediate', preferred_language: 'am', xp: 320,  streak_days: 4,  created_at: ago(30),  email: 'lilit@example.com' },
      { id: 'seed-8', full_name: 'Gor Manukyan',    username: 'gor',   bio: null, goal: 'Learn English',          skill_level: 'beginner',     preferred_language: 'am', xp: 180,  streak_days: 2,  created_at: ago(15),  email: 'gor@example.com' },
    ],
    events: [
      { id: 'ev-1', title: 'Armenian National Olympiad in Informatics', description: 'Nationwide competitive programming olympiad for school and university students. Top finishers qualify for the international team.', event_type: 'competition', organizer: 'Ministry of Education', location: 'Yerevan', is_online: false, deadline: inDays(18), link: 'https://example.com', upvote_count: 42, is_approved: true },
      { id: 'ev-2', title: 'TUMO Scholarship Program 2026', description: 'Full scholarship covering advanced courses in programming, design and robotics for talented teenagers.', event_type: 'scholarship', organizer: 'TUMO Center', location: 'Yerevan', is_online: false, deadline: inDays(30), link: 'https://example.com', upvote_count: 67, is_approved: true },
      { id: 'ev-3', title: 'Google Developer Student Internship', description: 'Summer internship for students passionate about software engineering, working on real products with mentors.', event_type: 'internship', organizer: 'Google', location: null, is_online: true, deadline: inDays(12), link: 'https://example.com', upvote_count: 51, is_approved: true },
      { id: 'ev-4', title: 'FAST Foundation Research Grant', description: 'Funding grant for student-led research projects in science and technology. Up to $5,000 per team.', event_type: 'grant', organizer: 'FAST Foundation', location: 'Yerevan', is_online: false, deadline: inDays(45), link: 'https://example.com', upvote_count: 29, is_approved: true },
      { id: 'ev-5', title: 'Intro to Machine Learning — Free Course', description: 'A 6-week hands-on online course covering the fundamentals of ML with Python. Beginner friendly.', event_type: 'course', organizer: 'AUA Extension', location: null, is_online: true, deadline: inDays(7), link: 'https://example.com', upvote_count: 38, is_approved: true },
      { id: 'ev-6', title: 'Yerevan Youth Leadership Fellowship', description: 'A 3-month fellowship building leadership and project-management skills, ending in a community project.', event_type: 'fellowship', organizer: 'UNICEF Armenia', location: 'Yerevan', is_online: false, deadline: inDays(25), link: 'https://example.com', upvote_count: 33, is_approved: true },
    ],
    chats: [],
    lessons: [],
    messages: [],
  };
}

/* ── Storage (localStorage in browser, in-memory on server) ───────────── */
let memoryDB: DB | null = null;
let memoryUsers: any[] | null = null;
let memorySession: Session = null;

function loadDB(): DB {
  if (isBrowser()) {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { try { return JSON.parse(raw); } catch { /* fall through */ } }
    const seeded = seedDB();
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
  if (!memoryDB) memoryDB = seedDB();
  return memoryDB;
}
function saveDB(db: DB) {
  if (isBrowser()) localStorage.setItem(DB_KEY, JSON.stringify(db));
  else memoryDB = db;
}
function loadUsers(): any[] {
  if (isBrowser()) {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  return memoryUsers ?? (memoryUsers = []);
}
function saveUsers(users: any[]) {
  if (isBrowser()) localStorage.setItem(USERS_KEY, JSON.stringify(users));
  else memoryUsers = users;
}
function loadSession(): Session {
  if (isBrowser()) {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  return memorySession;
}
function saveSession(s: Session) {
  if (isBrowser()) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } else {
    memorySession = s;
  }
}

/* ── Auth listeners (module-level so every client instance shares them) ── */
const listeners = new Set<AuthCallback>();
function notify(event: string) {
  const s = loadSession();
  const session = s ? mockSession(s.user) : null;
  listeners.forEach((cb) => {
    try { cb(event, session); } catch { /* ignore listener errors */ }
  });
}

function makeUser(id: string, email: string, fullName: string): MockUser {
  return {
    id,
    email,
    user_metadata: { full_name: fullName },
    app_metadata: { provider: 'email' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };
}
function mockSession(user: MockUser) {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
}

/* ── Query builder ────────────────────────────────────────────────────── */
type Op = 'select' | 'insert' | 'update' | 'delete';

class MockQuery implements PromiseLike<{ data: any; error: any }> {
  private filters: { col: string; val: any }[] = [];
  private op: Op = 'select';
  private payload: any = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private wantSingle = false;
  private returning = false;

  constructor(private table: string) {}

  select(_cols?: string) {
    if (this.op === 'select') this.op = 'select';
    this.returning = true;
    return this;
  }
  insert(rows: any) { this.op = 'insert'; this.payload = rows; return this; }
  update(vals: any) { this.op = 'update'; this.payload = vals; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col: string, val: any) { this.filters.push({ col, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.wantSingle = true; return this; }
  maybeSingle() { this.wantSingle = true; return this; }

  private run(): { data: any; error: any } {
    const db = loadDB();
    const rows = db[this.table] || (db[this.table] = []);
    const match = (r: Row) => this.filters.every((f) => r[f.col] === f.val);

    if (this.op === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row) => ({
        id: p.id ?? uuid(),
        ...p,
      }));
      rows.push(...items);
      saveDB(db);
      const data = this.returning ? (this.wantSingle ? items[0] : items) : null;
      return { data, error: null };
    }

    if (this.op === 'update') {
      const updated: Row[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (match(rows[i])) {
          rows[i] = { ...rows[i], ...this.payload };
          updated.push(rows[i]);
        }
      }
      saveDB(db);
      const data = this.returning ? (this.wantSingle ? (updated[0] ?? null) : updated) : null;
      return { data, error: null };
    }

    if (this.op === 'delete') {
      db[this.table] = rows.filter((r) => !match(r));
      saveDB(db);
      return { data: null, error: null };
    }

    // select
    let result = rows.filter(match);
    if (this.orderCol) {
      const col = this.orderCol;
      result = [...result].sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);

    if (this.wantSingle) {
      if (result.length === 0) {
        return { data: null, error: { code: 'PGRST116', message: 'No rows found', details: null } };
      }
      return { data: result[0], error: null };
    }
    return { data: result, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

/* ── Auth API ─────────────────────────────────────────────────────────── */
const auth = {
  async getUser(_token?: string) {
    return { data: { user: loadSession()?.user ?? null }, error: null };
  },
  async getSession() {
    const s = loadSession();
    return { data: { session: s ? mockSession(s.user) : null }, error: null };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
    const users = loadUsers();
    if (users.find((u) => u.email === email)) {
      return { data: { user: null, session: null }, error: { message: 'User already registered' } };
    }
    const id = uuid();
    const fullName = options?.data?.full_name ?? '';
    const user = makeUser(id, email, fullName);
    users.push({ id, email, password, full_name: fullName });
    saveUsers(users);

    const db = loadDB();
    db.profiles = db.profiles || [];
    db.profiles.push({
      id, full_name: fullName, username: null, bio: null, goal: '',
      skill_level: 'beginner', preferred_language: 'am', xp: 0, streak_days: 0,
      created_at: new Date().toISOString(), email,
    });
    saveDB(db);

    saveSession({ user });
    notify('SIGNED_IN');
    // session present → no email confirmation needed (mock auto-confirms)
    return { data: { user, session: mockSession(user) }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const users = loadUsers();
    const u = users.find((x) => x.email === email);
    if (!u || u.password !== password) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    }
    const user = makeUser(u.id, u.email, u.full_name);
    saveSession({ user });
    notify('SIGNED_IN');
    return { data: { user, session: mockSession(user) }, error: null };
  },
  async signOut() {
    saveSession(null);
    notify('SIGNED_OUT');
    return { error: null };
  },
  async resend(_args?: any) {
    return { data: {}, error: null };
  },
  async updateUser({ data }: { data?: Record<string, any> }) {
    const s = loadSession();
    if (!s) return { data: { user: null }, error: { message: 'Not signed in' } };
    const user: MockUser = { ...s.user, user_metadata: { ...s.user.user_metadata, ...data } };
    saveSession({ user });
    if (data?.full_name != null) {
      const users = loadUsers();
      const u = users.find((x) => x.id === user.id);
      if (u) { u.full_name = data.full_name; saveUsers(users); }
    }
    notify('USER_UPDATED');
    return { data: { user }, error: null };
  },
  onAuthStateChange(cb: AuthCallback) {
    listeners.add(cb);
    const s = loadSession();
    setTimeout(() => cb('INITIAL_SESSION', s ? mockSession(s.user) : null), 0);
    return { data: { subscription: { unsubscribe() { listeners.delete(cb); } } } };
  },
};

/* ── Client factory ───────────────────────────────────────────────────── */
export function createMockClient(): any {
  return {
    auth,
    from(table: string) { return new MockQuery(table); },
    // no-op for any storage/rpc usage; extend if needed
    rpc: async () => ({ data: null, error: null }),
  };
}
