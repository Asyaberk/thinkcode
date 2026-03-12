import { useState, useEffect } from 'react';
import { getLesson, getTopicLessons } from '../api/topics';
import type { ApiLesson, Lesson } from '../types';

/** Converts ApiLesson to the Lesson shape used by LessonContent component */
export function apiLessonToLesson(al: ApiLesson): Lesson {
  return {
    id: al.id,
    sectionId: al.topic_id,
    title: al.title,
    content: al.content_markdown ?? al.summary ?? `# ${al.title}\n\nLesson content coming soon.`,
    resources: (al.materials ?? []).map(m => ({
      id: m.id,
      title: m.title,
      type: m.type as ('PDF' | 'Video' | 'Link' | 'Slides'),
      url: m.url,
      description: m.description ?? '',
    })),
  };
}

interface UseLessonResult {
  lesson: Lesson | null;
  isLoading: boolean;
  error: string | null;
}

/** Fetches first lesson for a given topicId, or fetches by lessonId directly */
export function useLessonForTopic(topicId: string | null): UseLessonResult {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getTopicLessons(topicId)
      .then(lessons => {
        if (cancelled) return;
        if (lessons.length === 0) {
          setLesson({
            id: topicId,
            sectionId: topicId,
            title: 'Lesson',
            content: '# No lesson content available yet.',
          });
          return;
        }
        // Fetch full lesson with materials
        return getLesson(lessons[0].id).then(full => {
          if (!cancelled) setLesson(apiLessonToLesson(full));
        });
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Failed to load lesson');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [topicId]);

  return { lesson, isLoading, error };
}
