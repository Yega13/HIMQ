import { describe, it, expect } from 'vitest';
import { keywords, matchOpportunities } from '@/lib/opportunities';

describe('keywords', () => {
  it('drops stopwords, short words and punctuation', () => {
    expect(keywords('Learn Python for a job')).toEqual(['python']);
  });

  it('dedupes and lowercases', () => {
    expect(keywords('React react REACT hooks')).toEqual(['react', 'hooks']);
  });

  it('keeps Cyrillic and Armenian content words', () => {
    expect(keywords('Изучить программирование')).toContain('программирование');
    expect(keywords('սովորել ծրագրավորում')).toContain('ծրագրավորում');
  });

  it('returns empty for an all-stopword / too-short topic', () => {
    expect(keywords('learn the c++')).toEqual([]); // "c++" -> "c" (too short)
  });
});

describe('matchOpportunities', () => {
  const events = [
    { title: 'Python Data Bootcamp', description: 'Learn python and pandas', upvote_count: 2 },
    { title: 'React Hackathon', description: 'Build a react app', upvote_count: 10 },
    { title: 'Design Workshop', description: 'Figma basics', upvote_count: 5 },
  ];

  it('returns events overlapping the topic keywords', () => {
    const out = matchOpportunities('Learn Python for data science', events);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Python Data Bootcamp');
  });

  it('returns empty when nothing overlaps', () => {
    expect(matchOpportunities('Guitar lessons', events)).toEqual([]);
  });

  it('returns empty when the topic has no usable keywords', () => {
    expect(matchOpportunities('learn the', events)).toEqual([]);
  });

  it('respects the limit and orders by score then upvotes', () => {
    const many = [
      { title: 'React and Python', description: 'python react', upvote_count: 1 }, // score 2
      { title: 'Python only', description: 'python', upvote_count: 9 },            // score 1
      { title: 'React only', description: 'react', upvote_count: 3 },              // score 1
    ];
    const out = matchOpportunities('python react', many, 2);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('React and Python');   // highest score first
    expect(out[1].title).toBe('Python only');        // tie broken by upvotes
  });
});
