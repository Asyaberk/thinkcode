/**
 * api/analytics.ts — Öğrenci analytics API fonksiyonları.
 *
 * Bu dosya frontend sayfaları için backend'e giden tüm analytics çağrılarını içerir.
 * DashboardPage, AnalyticsPage gibi sayfalar buradaki fonksiyonları kullanır.
 *
 * Temel URL: /api/v1/analytics (nginx proxy → backend:8000)
 */

import { api } from './client';

// ── Tipler ────────────────────────────────────────────────────────────────────

/** Bir konu için mastery (ustalık) verisi */
export interface TopicMastery {
  topic_id: string;
  topic_name: string;
  mastery_score: number;       // 0-100 arası yüzde puan
  problems_attempted: number;
  problems_passed: number;
  total_hints_used: number;
}

/** Dashboard için ana özet */
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

/** Haftalık ilerleme — grafik için veri noktaları */
export interface ProgressPoint {
  date: string;       // "2025-01-15" formatında tarih
  problems_solved: number;
  avg_score: number;
}

/** Submission geçmişi satırı */
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

/** AI Insight yanıtı */
export interface AiInsightResponse {
  insight: string;              // Kişiselleştirilmiş performans yorumu
  rank?: number | null;         // Sınıf sıralaması (#5 gibi)
  percentile?: number | null;   // Percentile (0-100)
  total_students?: number;      // Sınıftaki toplam öğrenci sayısı
}


// ── API Fonksiyonları ──────────────────────────────────────────────────────────

/**
 * Öğrencinin dashboard özet verisini getirir.
 * DashboardPage bileşeni bu fonksiyonu kullanır.
 *
 * Backend: GET /api/v1/analytics/me/dashboard
 */
export async function getMyDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>('/analytics/me/dashboard');
}

/**
 * Konu bazlı mastery listesini getirir.
 * Analytics grafiklerinde accuracy-by-topic için kullanılır.
 *
 * Backend: GET /api/v1/analytics/me/mastery
 */
export async function getMyMastery(): Promise<TopicMastery[]> {
  return api.get<TopicMastery[]>('/analytics/me/mastery');
}

/**
 * Son N günlük ilerleme verisi (grafik için zaman serisi).
 * AnalyticsPage'deki "Time Spent Coding" grafiği için.
 *
 * Backend: GET /api/v1/analytics/me/progress?days=30
 */
export async function getMyProgress(days = 30): Promise<ProgressPoint[]> {
  return api.get<ProgressPoint[]>(`/analytics/me/progress?days=${days}`);
}

/**
 * OpenAI tarafından üretilen kişiselleştirilmiş performans yorumu çeker.
 * AnalyticsPage'deki "AI Performance Insight" paneli bu fonksiyonu kullanır.
 * Eski: frontend'de doğrudan Gemini API çağrısı yapılıyordu.
 *
 * Backend: GET /api/v1/analytics/me/ai-insight
 */
export async function getMyAiInsight(): Promise<AiInsightResponse> {
  return api.get<AiInsightResponse>('/analytics/me/ai-insight');
}

/**
 * Son submission geçmişini getirir.
 * AnalyticsPage'deki hint usage pie chart için kullanılır.
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
 * Öğrencinin ardışık çalışma günü serisini getirir.
 * Backend: GET /api/v1/analytics/me/streak
 */
export async function getMyStreak(): Promise<StreakData> {
  return api.get<StreakData>('/analytics/me/streak');
}

/** Sınıf puan dağılımı bucket'ı */
export interface ClassDistributionBucket {
  bucket: number;   // 0, 10, 20... 90
  label: string;    // "0-10", "10-20" ...
  count: number;    // o aralıktaki öğrenci sayısı
}

/**
 * Sınıftaki öğrencilerin puan dağılımını 10'ar puanlık bucket'larla getirir.
 * DashboardPage'deki class distribution grafiği için.
 * Backend: GET /api/v1/analytics/me/class-distribution
 */
export async function getClassDistribution(): Promise<ClassDistributionBucket[]> {
  return api.get<ClassDistributionBucket[]>('/analytics/me/class-distribution');
}


