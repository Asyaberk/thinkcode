/**
 * api/flows.ts — Pedagogical Flow Designer API çağrıları
 *
 * KULLANIM:
 *   saveDraftFlow(payload)          → POST /flows/         — "Save Draft" butonu
 *   updateFlow(id, payload)         → PUT  /flows/{id}     — Canvas değişikliği
 *   deployFlow(id)                  → POST /flows/{id}/deploy — "Deploy to Students"
 *   getActiveFlow(classId)          → GET  /flows/active   — Öğrenci sayfası
 *   listFlows(classId?)             → GET  /flows/         — Instructor geçmişi
 *   deleteFlow(id)                  → DELETE /flows/{id}   — Draft sil
 */

import { api } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  label: string;
  config?: Record<string, unknown>;
}

export interface FlowConnection {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

export interface FlowJson {
  nodes: FlowNode[];
  connections: FlowConnection[];
}

export interface FlowConfig {
  consecutive_correct?: number;   // Mastery Gate
  max_hints?: number;             // Socratic Retry
  review_days?: number[];         // Spaced Retrieval [1, 3, 7]
  threshold_score?: number;       // Adaptive Branch
}

export interface CourseFlow {
  id: string;
  class_id: string;
  instructor_id: string;
  pattern: string;
  flow_json: FlowJson;
  config: FlowConfig;
  status: 'draft' | 'live';
  created_at: string;
  updated_at: string;
  message?: string;
}

export interface ActiveFlowResponse extends CourseFlow {
  has_active_flow: boolean;
}

export interface CreateFlowPayload {
  class_id: string;
  pattern: string;
  flow_json: FlowJson;
  config: FlowConfig;
}

export interface UpdateFlowPayload {
  pattern?: string;
  flow_json?: FlowJson;
  config?: FlowConfig;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Yeni flow oluştur (draft olarak kaydeder).
 * Flow Designer'daki "Save Draft" butonuna bağlanır.
 */
export async function saveDraftFlow(payload: CreateFlowPayload): Promise<CourseFlow> {
  return api.post<CourseFlow>('/flows/', payload);
}

/**
 * Mevcut flow'u güncelle (canvas değişikliği yaptıktan sonra).
 */
export async function updateFlow(flowId: string, payload: UpdateFlowPayload): Promise<CourseFlow> {
  return api.put<CourseFlow>(`/flows/${flowId}`, payload);
}

/**
 * Flow'u öğrencilere deploy et (status: draft → live).
 * Aynı sınıf için mevcut live flow varsa otomatik draft'a çekilir.
 */
export async function deployFlow(flowId: string): Promise<CourseFlow> {
  return api.post<CourseFlow>(`/flows/${flowId}/deploy`);
}

/**
 * Bir sınıfın aktif (live) flow'unu getir.
 * Öğrenci sayfası (LearningPage, QuestionPage) bu endpoint'i
 * çekerek davranışını belirler.
 *
 * has_active_flow = false ise varsayılan davranış (kısıtsız ilerle).
 */
export async function getActiveFlow(classId: string): Promise<ActiveFlowResponse> {
  return api.get<ActiveFlowResponse>(`/flows/active?class_id=${classId}`);
}

/**
 * Instructor'ın tüm flow'larını listeler.
 * classId verilirse o sınıfa göre filtrele.
 */
export async function listFlows(classId?: string): Promise<CourseFlow[]> {
  const query = classId ? `?class_id=${classId}` : '';
  return api.get<CourseFlow[]>(`/flows/${query}`);
}

/**
 * Draft flow sil. Live flow silinemez.
 */
export async function deleteFlow(flowId: string): Promise<void> {
  return api.delete<void>(`/flows/${flowId}`);
}


// ─── Spaced Retrieval ─────────────────────────────────────────────────────────

export interface SpacedReviewItem {
  id: string;
  topic_id: string;
  topic_name: string | null;
  problem_id: string;
  review_day: number;
  scheduled_at: string;
}

/**
 * Bugün (veya geçmişten birikmiş) vadesi gelmiş review'ları getir.
 * Dashboard kartı için kullanılır.
 */
export async function getDueSpacedReviews(classId: string): Promise<SpacedReviewItem[]> {
  return api.get<SpacedReviewItem[]>(`/flows/spaced-reviews?class_id=${classId}`);
}

/**
 * Öğrenci review sorusunu tamamladığında çağrılır.
 */
export async function completeSpacedReview(
  reviewId: string,
  isCorrect: boolean,
): Promise<void> {
  return api.post<void>(`/flows/spaced-reviews/${reviewId}/complete`, { is_correct: isCorrect });
}


// ─── Adaptive Branch ──────────────────────────────────────────────────────────

export interface DiagnosticProblem {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  options: { id: string; text: string; is_correct: boolean }[];
}

export interface AdaptiveStateResponse {
  diagnostic_done: boolean;
  assigned_path: 'basic' | 'advanced' | null;
  diagnostic_score: number | null;
  diagnostic_problems: DiagnosticProblem[];
}

/**
 * Öğrencinin bu konu için adaptive state'ini getir.
 * diagnostic_done=false ise frontend tanı soruları gösterir.
 */
export async function getAdaptiveState(
  classId: string,
  topicId: string,
): Promise<AdaptiveStateResponse> {
  return api.get<AdaptiveStateResponse>(
    `/flows/adaptive-state?class_id=${classId}&topic_id=${topicId}`,
  );
}

/**
 * Öğrenci 3 tanı sorusunu bitirince çağrılır.
 * Backend skoru hesaplar, 'basic' veya 'advanced' path atar.
 */
export async function completeAdaptiveDiagnostic(payload: {
  class_id: string;
  topic_id: string;
  correct_count: number;
  total_count: number;
}): Promise<{ assigned_path: 'basic' | 'advanced'; diagnostic_score: number; threshold: number }> {
  return api.post(`/flows/adaptive-complete`, payload);
}
