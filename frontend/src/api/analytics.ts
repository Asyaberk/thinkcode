/**

 *

 *

 * Temel URL: /api/v1/analytics (nginx proxy → backend:8000)

 */

import { api } from './client';

// ── Tipler ────────────────────────────────────────────────────────────────────

/** Mastery data for a single topic. */

export interface TopicMastery {

  topic_id: string;

  topic_name: string;

  mastery_score: number;

  problems_attempted: number;

  problems_passed: number;

  total_hints_used: number;

}

/** Main summary data for the student dashboard. */

export interface DashboardData {

  user: {

    id: string;

    email: string;

    first_name: string;

    last_name: string;

    role: string;

  };

  class_id: string | null;

  class_code: string | null;

  class_name: string | null;

  total_problems_attempted: number;

  total_problems_passed: number;

  overall_mastery_score: number;

  percentile: number;

  rank: number | null;

  total_students_in_class: number;

  weak_topics: TopicMastery[];

  strong_topics: TopicMastery[];

  all_topics: TopicMastery[];

}

/** Weekly progress data points for the chart. */

export interface ProgressPoint {

  date: string;

  problems_solved: number;

  avg_score: number;

}

/** A single row in the submission history. */

export interface SubmissionHistory {

  id: string;

  problem_id: string;

  status: string;

  score: number | null;

  max_score: number | null;

  is_correct: boolean | null;

  attempt_number: number;

  time_spent_seconds: number;

  submitted_at: string;    // ISO 8601 tarih string

}

/** AI insight response shape. */

export interface AiInsightResponse {

  insight: string;

  rank?: number | null;

  percentile?: number | null;   // Percentile (0-100)

  total_students?: number;

}

/**

 *

 * Backend: GET /api/v1/analytics/me/dashboard

 */

export async function getMyDashboard(classId?: string): Promise<DashboardData> {

  const qs = classId ? `?class_id=${classId}` : '';

  return api.get<DashboardData>(`/analytics/me/dashboard${qs}`);

}

/**

 *

 * Backend: GET /api/v1/analytics/me/mastery

 */

export async function getMyMastery(): Promise<TopicMastery[]> {

  return api.get<TopicMastery[]>('/analytics/me/mastery');

}

/**

 *

 * Backend: GET /api/v1/analytics/me/progress?days=30

 */

export async function getMyProgress(days = 30): Promise<ProgressPoint[]> {

  return api.get<ProgressPoint[]>(`/analytics/me/progress?days=${days}`);

}

/**

 *

 * Backend: GET /api/v1/analytics/me/ai-insight

 */

export async function getMyAiInsight(): Promise<AiInsightResponse> {

  return api.get<AiInsightResponse>('/analytics/me/ai-insight');

}

/**

 *

 * Backend: GET /api/v1/analytics/me/submissions?limit=100

 */

export async function getMySubmissions(limit = 100): Promise<SubmissionHistory[]> {

  return api.get<SubmissionHistory[]>(`/analytics/me/submissions?limit=${limit}`);

}

/** Streak verisi */

export interface StreakData {

  streak_days: number;

  last_active: string | null;

}

/**

 * Backend: GET /api/v1/analytics/me/streak

 */

export async function getMyStreak(): Promise<StreakData> {

  return api.get<StreakData>('/analytics/me/streak');

}

/** Score distribution bucket for a class. */

export interface ClassDistributionBucket {

  bucket: number;   // 0, 10, 20... 90

  label: string;    // "0-10", "10-20" ...

  count: number;

}

/**

 * Backend: GET /api/v1/analytics/me/class-distribution

 */

export async function getClassDistribution(): Promise<ClassDistributionBucket[]> {

  return api.get<ClassDistributionBucket[]>('/analytics/me/class-distribution');

}

