// Registry of Practice Labs. Each lab is a hand-built, deterministic interactive
// sandbox with CORRECT behavior (no AI-guessed physics). `status: 'live'` labs
// render their component; 'soon' labs show as coming-soon cards. `topics` are
// lowercase keywords used to match a learning lesson to a relevant lab, so May
// can offer "Practice in the Lab" from inside a path.

export type LabStatus = 'live' | 'soon';

export interface LabMeta {
  id: string;
  title: string;
  subject: string;      // e.g. "Electrical Engineering"
  blurb: string;        // one-line description
  status: LabStatus;
  emoji: string;
  topics: string[];     // keywords a lesson/goal might contain
}

export const LABS: LabMeta[] = [
  {
    id: 'circuits',
    title: 'Diodes & Current Limiting',
    subject: 'Electrical Engineering',
    blurb: 'Build a real circuit — battery, resistor, LED. Reverse the diode and it goes dark; skip the resistor and it burns out.',
    status: 'live',
    emoji: '⚡',
    topics: ['circuit', 'circuits', 'diode', 'diodes', 'led', 'resistor', 'ohm', 'current', 'voltage', 'electronic', 'electronics', 'electrical'],
  },
  {
    id: 'graphs',
    title: 'Graphs & Traversals',
    subject: 'Computer Science',
    blurb: 'Drop nodes, draw edges, and watch BFS/DFS walk the graph step by step.',
    status: 'soon',
    emoji: '🕸️',
    topics: ['graph', 'graphs', 'tree', 'bfs', 'dfs', 'traversal', 'node', 'edge', 'shortest path'],
  },
  {
    id: 'robotics',
    title: 'Robot Kinematics',
    subject: 'Robotics',
    blurb: 'Drive a 2-joint arm and see how angles become reach.',
    status: 'soon',
    emoji: '🤖',
    topics: ['robot', 'robotics', 'kinematics', 'servo', 'joint', 'arm', 'motor'],
  },
  {
    id: 'ml',
    title: 'Gradient Descent',
    subject: 'Machine Learning',
    blurb: 'Tune a learning rate and watch the loss roll downhill (or diverge).',
    status: 'soon',
    emoji: '📉',
    topics: ['machine learning', 'ml', 'gradient', 'descent', 'loss', 'neural', 'training', 'model'],
  },
];

export function getLab(id: string): LabMeta | undefined {
  return LABS.find((l) => l.id === id);
}

// Find a live lab whose topics appear in the given text (lesson title/goal).
// Returns the lab id or null. Used to offer in-path practice.
export function matchLab(text: string | undefined | null): string | null {
  if (!text) return null;
  const hay = text.toLowerCase();
  for (const lab of LABS) {
    if (lab.status !== 'live') continue;
    if (lab.topics.some((kw) => hay.includes(kw))) return lab.id;
  }
  return null;
}
