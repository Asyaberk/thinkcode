/**
 *
 * GET /api/v1/instructor/me/classes
 *
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface InstructorClass {
  class_id: string;
  class_name: string;
  class_code: string;
  semester: string;
  total_students: number;
  has_live_flow: boolean;
  active_pattern: string | null;
}

export function useInstructorClasses(): {
  classes: InstructorClass[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [classes, setClasses] = useState<InstructorClass[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    let cancelled = false;
    setIsLoading(true);

    api.get<InstructorClass[]>('/instructor/me/classes')
      .then(data => {
        if (!cancelled) {
          setClasses(data);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Classes fetch failed');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [trigger]);

  const refetch = useCallback(() => setTrigger(p => p + 1), []);

  return { classes, isLoading, error, refetch };
}
