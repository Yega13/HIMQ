// Registry of exams HIMQ can prep for. Each is a curated entry point into the
// normal learning engine: picking an exam seeds a path with the exam's real
// structure, the student's target score, and the exam date — so May builds a
// section-mapped, deadline-paced prep plan instead of guessing.

export type ExamStatus = 'live' | 'soon';

export interface ExamMeta {
  id: string;
  name: string;        // short label, e.g. "IELTS"
  fullName: string;    // spelled out
  category: 'english' | 'university' | 'armenian';
  emoji: string;
  blurb: string;
  sections: string[];  // the exam's real sections/papers
  scoreLabel: string;  // what the target input means, e.g. "Target band (1–9)"
  scoreHint?: string;  // clarifies total-vs-section scoring
  scorePlaceholder: string;
  status: ExamStatus;
}

export const EXAM_CATEGORIES: Record<ExamMeta['category'], string> = {
  armenian: 'Armenian state exams',
  english: 'English proficiency',
  university: 'University admissions',
};

export const EXAMS: ExamMeta[] = [
  {
    id: 'unified-math',
    name: 'Unified — Mathematics',
    fullName: 'Armenian Unified State Exam · Mathematics',
    category: 'armenian',
    emoji: '📐',
    blurb: 'The national maths exam used for university admission in Armenia. Algebra, functions, geometry and problem-solving.',
    sections: ['Algebra', 'Functions & graphs', 'Geometry', 'Problem solving'],
    scoreLabel: 'Target score (0–20)',
    scoreHint: "Armenia's 20-point unified-exam scale",
    scorePlaceholder: '18',
    status: 'live',
  },
  {
    id: 'unified-armenian',
    name: 'Unified — Armenian',
    fullName: 'Armenian Unified State Exam · Armenian Language & Literature',
    category: 'armenian',
    emoji: '📜',
    blurb: 'The national Armenian language & literature exam — grammar, orthography, text analysis and essay writing.',
    sections: ['Grammar & orthography', 'Text analysis', 'Literature', 'Essay writing'],
    scoreLabel: 'Target score (0–20)',
    scoreHint: "Armenia's 20-point unified-exam scale",
    scorePlaceholder: '18',
    status: 'live',
  },
  {
    id: 'ielts',
    name: 'IELTS',
    fullName: 'International English Language Testing System',
    category: 'english',
    emoji: '🇬🇧',
    blurb: 'The English test for studying abroad. Four papers, band-scored 1–9 — with real practice in each.',
    sections: ['Listening', 'Reading', 'Writing', 'Speaking'],
    scoreLabel: 'Target overall band (1–9)',
    scoreHint: 'Overall band = average of the 4 sections (each 1–9)',
    scorePlaceholder: '7.0',
    status: 'live',
  },
  {
    id: 'toefl',
    name: 'TOEFL',
    fullName: 'Test of English as a Foreign Language (iBT)',
    category: 'english',
    emoji: '🗽',
    blurb: 'The US-oriented English proficiency test — four sections, scored 1–6 overall in the new 2026 format.',
    sections: ['Reading', 'Listening', 'Speaking', 'Writing'],
    scoreLabel: 'Target overall score (1–6)',
    scoreHint: 'New 2026 format: 4 sections each 1–6, overall = their average (a 0–120 comparable score is also given during the transition).',
    scorePlaceholder: '5.0',
    status: 'live',
  },
  {
    id: 'sat',
    name: 'SAT',
    fullName: 'SAT (College Admissions Test)',
    category: 'university',
    emoji: '🎓',
    blurb: 'For US university admission. Digital SAT: Reading & Writing plus Math, scored 400–1600.',
    sections: ['Reading & Writing', 'Math'],
    scoreLabel: 'Target total score (400–1600)',
    scoreHint: 'Total of 2 sections (Reading & Writing, Math — each 200–800)',
    scorePlaceholder: '1400',
    status: 'live',
  },
  {
    id: 'gre',
    name: 'GRE',
    fullName: 'Graduate Record Examinations',
    category: 'university',
    emoji: '🧠',
    blurb: 'For graduate school admission — verbal, quantitative and analytical writing.',
    sections: ['Verbal Reasoning', 'Quantitative Reasoning', 'Analytical Writing'],
    scoreLabel: 'Target total (260–340)',
    scoreHint: 'Verbal + Quant, each 130–170 (Writing scored 0–6 separately)',
    scorePlaceholder: '320',
    status: 'soon',
  },
];

export function getExam(id: string): ExamMeta | undefined {
  return EXAMS.find((e) => e.id === id);
}

// Build the goal string handed to the normal create-path flow. Concise enough
// to read as the chat title, but carries the exam, target, date and sections so
// discovery + planning are exam-aware.
export function examGoal(exam: ExamMeta, target: string, date: string): string {
  const bits = [`${exam.name} prep`];
  if (target.trim()) bits.push(`— target ${target.trim()}`);
  if (date) bits.push(`by ${date}`);
  bits.push(`(sections: ${exam.sections.join(', ')})`);
  return bits.join(' ');
}
