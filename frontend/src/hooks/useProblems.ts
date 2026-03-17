import { useState, useEffect } from 'react';
import { getProblems } from '../api/problems';
import type { ApiProblem, Problem } from '../types';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Maps backend ApiProblem to the UI Problem shape */
export function apiProblemToUIProblem(p: ApiProblem, submittedIds: Set<string> = new Set()): Problem {
  const typeMap: Record<string, Problem['type']> = {
    coding: 'Coding',
    multiple_choice: 'Multiple Choice',
    open_response: 'Open Response',
  };
  const diffMap: Record<string, Problem['difficulty']> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  };
  return {
    id: p.id,
    title: p.title,
    difficulty: diffMap[p.difficulty] ?? 'Easy',
    type: typeMap[p.type] ?? 'Coding',
    topic: p.topic_id,   // will be enriched by topic name in the page
    status: submittedIds.has(p.id) ? 'Solved' : 'Unsolved',
    attempts: 0,
    questionId: p.id,    // we use the real problem id now
  };
}

interface UseProblemsResult {
  problems: ApiProblem[];
  uiProblems: Problem[];
  isLoading: boolean;
  error: string | null;
}

export function useProblems(): UseProblemsResult {
  const [problems, setProblems] = useState<ApiProblem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getProblems()
      .then(data => {
        if (!cancelled) { setProblems(data); setError(null); }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Failed to load problems');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const uiProblems = problems.map(p => apiProblemToUIProblem(p));
  return { problems, uiProblems, isLoading, error };
}
