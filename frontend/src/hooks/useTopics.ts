import { useState, useEffect } from 'react';

import { getTopics } from '../api/topics';

import type { Topic, Section } from '../types';

interface UseTopicsResult {

  topics: Topic[];

  sections: Section[];

  isLoading: boolean;

  error: string | null;

}

function topicsToSections(topics: Topic[]): Section[] {

  return topics.map(t => ({

    id: t.id,

    title: t.name,

    isCompleted: false,           // App.tsx topicMasteryMap ile override edilir

    parentId: t.parent_topic_id,

  }));

}

/**

 */

export function useTopics(classId?: string | null): UseTopicsResult {

  const [topics, setTopics]     = useState<Topic[]>([]);

  const [isLoading, setLoading] = useState(true);

  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    getTopics(classId ?? undefined)

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

        if (!cancelled) setLoading(false);

      });

    return () => { cancelled = true; };

  }, [classId]);

  const sections = topicsToSections(topics);

  return { topics, sections, isLoading, error };

}

