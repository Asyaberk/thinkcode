import { useState, useEffect } from 'react';
import { getTopics } from '../api/topics';
import type { Topic, Section } from '../types';

interface UseTopicsResult {
  topics: Topic[];
  sections: Section[];  // UI'ya uyumlu Section formatı
  isLoading: boolean;
  error: string | null;
}

/**
 * Converts flat Topic list to nested display.
 * Only parent topics (no parent_topic_id) are shown as top-level sections.
 * Sub-topics are included with indented titles.
 */
function topicsToSections(topics: Topic[]): Section[] {
  const difficultyMap: Record<string, boolean> = {};
  return topics.map(t => ({
    id: t.id,
    title: t.name,
    isCompleted: difficultyMap[t.id] ?? false,
  }));
}

export function useTopics(): UseTopicsResult {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getTopics()
      .then(data => {
        if (!cancelled) {
          setTopics(data);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Failed to load topics');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const sections = topicsToSections(topics);
  return { topics, sections, isLoading, error };
}
