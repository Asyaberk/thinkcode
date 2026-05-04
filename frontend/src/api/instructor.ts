/**

 *

 *

 * Temel URL: /api/v1/instructor (nginx proxy → backend:8000)

 */

import { api } from './client';

// ── Tipler ────────────────────────────────────────────────────────────────────

/** Class info for the currently logged-in instructor. */

export interface MyClassInfo {

  class_id: string;

  class_name: string;

  class_code: string;

  semester: string | null;

  total_students: number;

}

/** Class score distribution — data for the bar chart. */

export interface DistributionBucket {

  range: string;     // "0-20", "20-40", "40-60", "60-80", "80-100"

  count: number;

}

/** Knowledge gap detected in a class. */

export interface KnowledgeGap {

  topic_id: string;

  topic_name: string;

  problem_id: string | null;

  problem_title: string | null;

  failure_rate_pct: number;

  unique_students: number;

  failures: number;

}

/** Student ranking row. */

export interface StudentRanking {

  student_id: string;

  first_name: string;

  last_name: string;

  avg_mastery: number;

  percentile: number;

  total_attempted: number;

  weak_topic_name: string | null;

}

/** Full instructor dashboard response. */

export interface InstructorDashboardData {

  class_id: string;

  class_name: string;

  class_code: string;

  total_students: number;

  average_mastery: number;

  median_mastery: number;        // Medyan

  students_with_activity: number;

  knowledge_gaps: KnowledgeGap[];

  topic_heatmap: any[];

  top_students: StudentRanking[];

  bottom_students: StudentRanking[];

}

/** AI gap analysis response. */

export interface GapAnalysisResult {

  gaps_detected: number;

  new_gaps_persisted: number;

  ai_analysis: string | null;

  top_gap: KnowledgeGap | null;

}

/**

 *

 * Backend: GET /api/v1/instructor/me/class

 */

export async function getMyClass(): Promise<MyClassInfo> {

  return api.get<MyClassInfo>('/instructor/me/class');

}

/**

 *

 * Backend: GET /api/v1/instructor/{class_id}/dashboard

 */

export async function getInstructorDashboard(classId: string): Promise<InstructorDashboardData> {

  return api.get<InstructorDashboardData>(`/instructor/${classId}/dashboard`);

}

/**

 *

 * Backend: GET /api/v1/instructor/{class_id}/students

 */

export async function getClassStudents(classId: string): Promise<StudentRanking[]> {

  return api.get<StudentRanking[]>(`/instructor/${classId}/students`);

}

/**

 *

 * Backend: POST /api/v1/instructor/{class_id}/analyze-gaps

 */

export async function analyzeClassGaps(classId: string): Promise<GapAnalysisResult> {

  return api.post<GapAnalysisResult>(`/instructor/${classId}/analyze-gaps`);

}

