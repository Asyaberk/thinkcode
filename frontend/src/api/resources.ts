/**
 * api/resources.ts — Instructor Resource Upload & Processing API
 *
 * Hocanın dosya yüklemesi, AI ile işlemesi ve sonuçları görmesi için
 * /api/v1/resources endpoint'leriyle iletişim kurar.
 *
 * Not: Upload için multipart/form-data gerektiğinden api.client kullanılmaz,
 * doğrudan fetch yapılır (Authorization header manuel eklenir).
 */

const BASE_URL = '/api/v1';

function getToken(): string {
  return localStorage.getItem('access_token') || '';
}

// ── Tipler ─────────────────────────────────────────────────────────────────────

export interface ResourceItem {
  resource_id:   string;
  filename:      string;
  file_type:     string;
  week_name:     string | null;
  status:        'uploaded' | 'processing' | 'done' | 'failed';
  error_message: string | null;
  created_at:    string;
}

export interface ResourceResult {
  resource_id:      string;
  filename:         string;
  status:           string;
  error_message:    string | null;
  topics_created:   number;
  lessons_created:  number;
  problems_created: number;
}

export interface ExtractedLesson {
  title:             string;
  summary:           string;
  content_markdown:  string;
  estimated_minutes: number;
}

export interface ExtractedQuestion {
  title:          string;
  description:    string;
  type:           string;
  difficulty:     string;
  correct_answer: string;
  options:        { text: string; is_correct: boolean }[];
  hints:          { level: number; content: string; socratic_question: string | null }[];
  misconception:  string;
}

export interface ExtractedTopic {
  name:        string;
  description: string;
  lessons:     ExtractedLesson[];
  questions:   ExtractedQuestion[];
}

export interface ExtractedContent {
  course_title:   string;
  topics:         ExtractedTopic[];
  misconceptions: string[];
}

// ── API Fonksiyonları ──────────────────────────────────────────────────────────

/**
 * Dosya yükler. Multipart/form-data gönderilir.
 * week_name opsiyonel — verilirse parent topic olarak işlenir.
 */
export async function uploadResource(
  file: File,
  weekName?: string
): Promise<{ resource_id: string; filename: string; status: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  if (weekName?.trim()) {
    form.append('week_name', weekName.trim());
  }

  const response = await fetch(`${BASE_URL}/resources/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Yüklenmiş bir kaynağı AI ile işler.
 * Arka planda çalışır; sonucu pollResult ile sorgulanır.
 */
export async function processResource(
  resourceId: string
): Promise<{ resource_id: string; status: string; message: string }> {
  const response = await fetch(`${BASE_URL}/resources/${resourceId}/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Process failed: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * İşlem durumunu sorgular.
 * 'done' veya 'failed' olana kadar periyodik çağrılır.
 */
export async function pollResult(resourceId: string): Promise<ResourceResult> {
  const response = await fetch(`${BASE_URL}/resources/${resourceId}/result`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(`Poll failed: HTTP ${response.status}`);
  return response.json();
}

/**
 * Bu instructora ait tüm kaynakları listeler.
 */
export async function listResources(): Promise<ResourceItem[]> {
  const response = await fetch(`${BASE_URL}/resources/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(`List failed: HTTP ${response.status}`);
  return response.json();
}

/**
 * İşlenmiş kaynağın GPT çıktısını döndürür.
 * Content Builder sekmelerini doldurmak için kullanılır.
 */
export async function getResourceContent(resourceId: string): Promise<ExtractedContent> {
  const response = await fetch(`${BASE_URL}/resources/${resourceId}/content`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(`Content fetch failed: HTTP ${response.status}`);
  return response.json();
}
