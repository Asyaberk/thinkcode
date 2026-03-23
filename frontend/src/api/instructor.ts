/**
 * api/instructor.ts — Instructor dashboard API fonksiyonları.
 *
 * InstructorDashboard.tsx bu dosyadaki fonksiyonları kullanarak
 * hardcoded mock data yerine gerçek backend verisini çeker.
 *
 * Temel URL: /api/v1/instructor (nginx proxy → backend:8000)
 */

import { api } from './client';

// ── Tipler ────────────────────────────────────────────────────────────────────

/** Login olan instructor'ın class bilgisi */
export interface MyClassInfo {
  class_id: string;
  class_name: string;
  class_code: string;
  semester: string | null;
  total_students: number;
}

/** Sınıf başarı dağılımı — bar chart için */
export interface DistributionBucket {
  range: string;     // "0-20", "20-40", "40-60", "60-80", "80-100"
  count: number;
}

/** Sınıf bilgi boşluğu */
export interface KnowledgeGap {
  topic_id: string;
  topic_name: string;
  problem_id: string | null;
  problem_title: string | null;
  failure_rate_pct: number;       // 0-100 arası yüzde
  unique_students: number;
  failures: number;
}

/** Öğrenci sıralama satırı */
export interface StudentRanking {
  student_id: string;
  first_name: string;
  last_name: string;
  avg_mastery: number;         // 0-100 arası ortalama mastery skoru
  percentile: number;
  total_attempted: number;
  weak_topic_name: string | null;
}

/** Tam instructor dashboard yanıtı */
export interface InstructorDashboardData {
  class_id: string;
  class_name: string;
  class_code: string;
  total_students: number;
  average_mastery: number;       // Sınıf ortalaması
  median_mastery: number;        // Medyan
  students_with_activity: number;
  knowledge_gaps: KnowledgeGap[];
  topic_heatmap: any[];
  top_students: StudentRanking[];
  bottom_students: StudentRanking[];
}

/** AI gap analizi yanıtı */
export interface GapAnalysisResult {
  gaps_detected: number;
  new_gaps_persisted: number;
  ai_analysis: string | null;
  top_gap: KnowledgeGap | null;
}

// ── API Fonksiyonları ──────────────────────────────────────────────────────────

/**
 * Login olan instructor'ın kendi class bilgisini getirir.
 * InstructorDashboard bileşeni bu class_id ile diğer endpoint'leri çağırır.
 *
 * Backend: GET /api/v1/instructor/me/class
 */
export async function getMyClass(): Promise<MyClassInfo> {
  return api.get<MyClassInfo>('/instructor/me/class');
}

/**
 * Sınıf dashboard verisini getirir (öğrenci listesi, knowledge gaps, istatistikler).
 *
 * Backend: GET /api/v1/instructor/{class_id}/dashboard
 */
export async function getInstructorDashboard(classId: string): Promise<InstructorDashboardData> {
  return api.get<InstructorDashboardData>(`/instructor/${classId}/dashboard`);
}

/**
 * Sınıf öğrenci listesini getirir (sıralama dahil).
 *
 * Backend: GET /api/v1/instructor/{class_id}/students
 */
export async function getClassStudents(classId: string): Promise<StudentRanking[]> {
  return api.get<StudentRanking[]>(`/instructor/${classId}/students`);
}

/**
 * AI ile sınıf bilgi boşluklarını analiz eder ve kaydeder.
 * InstructorDashboard'daki "Generate Report" butonu bu fonksiyonu çağırır.
 *
 * Backend: POST /api/v1/instructor/{class_id}/analyze-gaps
 */
export async function analyzeClassGaps(classId: string): Promise<GapAnalysisResult> {
  return api.post<GapAnalysisResult>(`/instructor/${classId}/analyze-gaps`);
}
