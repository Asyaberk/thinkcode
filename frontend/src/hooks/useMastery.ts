/**
 * useMastery.ts — Ogrenci topic mastery verisini ceker
 *
 * StudentDashboardOut'tan gelen mastery_rows'u cache'ler.
 * Dashboard ve QuestionPage icin gercel mastery skorlarini saglar.
 * Her login veya submission sonrasi yenilenebilir (refetch()).
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface TopicMastery {
  topic_id: string;
  topic_name: string;
  mastery_score: number;
  problems_attempted: number;
  problems_passed: number;
  total_hints_used: number;
}

export interface DashboardData {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  class_id: string | null;
  total_problems_attempted: number;
  total_problems_passed: number;
  overall_mastery_score: number;
  percentile: number;
  rank: number | null;
  total_students_in_class: number;
  weak_topics: TopicMastery[];
  strong_topics: TopicMastery[];
  recent_mastery: TopicMastery[];
  all_topics: TopicMastery[];  // Tüm konuların mastery listesi
}

interface UseMasteryResult {
  dashboard: DashboardData | null;
  classId: string | null;
  /** topic_id → mastery_score eşleştirmesi */
  topicMasteryMap: Record<string, number>;
  /** topic_id → problems_passed eşleştirmesi */
  topicPassedMap: Record<string, number>;
  /** topic_id → problems_attempted eşleştirmesi (isCompleted için: passed===attempted) */
  topicAttemptedMap: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMastery(): UseMasteryResult {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    // Token yoksa fetch yapma
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // GET /api/v1/analytics/me/dashboard — mastery, percentile, class_id
    api.get<DashboardData>('/analytics/me/dashboard')
      .then(data => {
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Dashboard fetch failed');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchTrigger]);

  const refetch = useCallback(() => {
    // Submission sonrasi mastery'yi guncellemek icin trigger'i artir
    setFetchTrigger(prev => prev + 1);
  }, []);

  return {
    dashboard,
    classId: dashboard?.class_id ?? null,
    topicMasteryMap: Object.fromEntries(
      (dashboard?.all_topics ?? []).map(t => [t.topic_id, t.mastery_score])
    ),
    topicPassedMap: Object.fromEntries(
      (dashboard?.all_topics ?? []).map(t => [t.topic_id, t.problems_passed])
    ),
    topicAttemptedMap: Object.fromEntries(
      (dashboard?.all_topics ?? []).map(t => [t.topic_id, t.problems_attempted])
    ),
    isLoading,
    error,
    refetch,
  };
}
