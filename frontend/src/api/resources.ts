/**
 * api/resources.ts — Instructor Resource Upload, Processing & CRUD API
 */

const BASE_URL = '/api/v1';

function getToken(): string {
  return localStorage.getItem('access_token') || '';
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}
function jsonHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

// ── Tipler (Resource pipeline) ────────────────────────────────────────────────

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

// ── Tipler (DB entity — instructor CRUD) ──────────────────────────────────────

export interface DbTopic {
  id:              string;
  name:            string;
  description:     string | null;
  display_order:   number;
  parent_topic_id: string | null;
}

export interface DbLesson {
  id:                string;
  topic_id:          string;
  title:             string;
  summary:           string | null;
  content_markdown:  string | null;
  estimated_minutes: number | null;
  display_order:     number;
}

export interface DbOption {
  id:            string;
  text:          string;
  is_correct:    boolean;
  display_order: number;
}

export interface DbProblem {
  id:             string;
  topic_id:       string;
  lesson_id:      string | null;
  title:          string;
  description:    string;
  type:           string;
  difficulty:     string;
  correct_answer: string | null;
  points:         number;
  options:        DbOption[];
}

// ── Upload / Process ──────────────────────────────────────────────────────────

export async function uploadResource(
  file: File,
  weekName?: string
): Promise<{ resource_id: string; filename: string; status: string; message: string }> {
  const form = new FormData();
  form.append('file', file);
  if (weekName?.trim()) form.append('week_name', weekName.trim());
  const res = await fetch(`${BASE_URL}/resources/upload`, {
    method: 'POST', headers: authHeaders(), body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function processResource(
  resourceId: string
): Promise<{ resource_id: string; status: string; message: string }> {
  const res = await fetch(`${BASE_URL}/resources/${resourceId}/process`, {
    method: 'POST', headers: jsonHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Process failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function pollResult(resourceId: string): Promise<ResourceResult> {
  const res = await fetch(`${BASE_URL}/resources/${resourceId}/result`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Poll failed: HTTP ${res.status}`);
  return res.json();
}

export async function listResources(): Promise<ResourceItem[]> {
  const res = await fetch(`${BASE_URL}/resources/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`List failed: HTTP ${res.status}`);
  return res.json();
}

export async function getResourceContent(resourceId: string): Promise<ExtractedContent> {
  const res = await fetch(`${BASE_URL}/resources/${resourceId}/content`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Content fetch failed: HTTP ${res.status}`);
  return res.json();
}

// ── Instructor CRUD — Topics ──────────────────────────────────────────────────

export async function listTopics(): Promise<DbTopic[]> {
  const r = await fetch(`${BASE_URL}/topics`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`List topics failed: ${r.status}`);
  return r.json();
}

export async function updateTopic(
  id: string,
  body: { name?: string; description?: string }
): Promise<DbTopic> {
  const r = await fetch(`${BASE_URL}/topics/${id}`, {
    method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Update topic failed: ${r.status}`);
  return r.json();
}

export async function deleteTopic(id: string): Promise<void> {
  const r = await fetch(`${BASE_URL}/topics/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!r.ok) throw new Error(`Delete topic failed: ${r.status}`);
}

// ── Instructor CRUD — Lessons ─────────────────────────────────────────────────

export async function getTopicLessons(topicId: string): Promise<DbLesson[]> {
  const r = await fetch(`${BASE_URL}/topics/${topicId}/lessons`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`Get lessons failed: ${r.status}`);
  return r.json();
}

export async function updateLesson(
  id: string,
  body: { title?: string; summary?: string; content_markdown?: string; estimated_minutes?: number }
): Promise<DbLesson> {
  const r = await fetch(`${BASE_URL}/lessons/${id}`, {
    method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Update lesson failed: ${r.status}`);
  return r.json();
}

export async function deleteLesson(id: string): Promise<void> {
  const r = await fetch(`${BASE_URL}/lessons/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!r.ok) throw new Error(`Delete lesson failed: ${r.status}`);
}

// ── Instructor CRUD — Problems ────────────────────────────────────────────────

export async function getTopicProblems(topicId: string): Promise<DbProblem[]> {
  const r = await fetch(`${BASE_URL}/problems/by-topic/${topicId}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`Get problems failed: ${r.status}`);
  return r.json();
}

export async function updateProblem(
  id: string,
  body: {
    title?: string;
    description?: string;
    difficulty?: string;
    correct_answer?: string;
    options?: { id?: string; text: string; is_correct: boolean }[];
  }
): Promise<DbProblem> {
  const r = await fetch(`${BASE_URL}/problems/${id}`, {
    method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Update problem failed: ${r.status}`);
  return r.json();
}

export async function deleteProblem(id: string): Promise<void> {
  const r = await fetch(`${BASE_URL}/problems/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!r.ok) throw new Error(`Delete problem failed: ${r.status}`);
}

// ── Instructor CREATE ────────────────────────────────────────────────────────

export async function createTopic(body: { name: string; description?: string }): Promise<DbTopic> {
  const r = await fetch(`${BASE_URL}/topics`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Create topic failed: ${r.status}`);
  return r.json();
}

export async function createLesson(
  topicId: string,
  body: { title: string; summary?: string; estimated_minutes?: number }
): Promise<DbLesson> {
  const r = await fetch(`${BASE_URL}/topics/${topicId}/lessons`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Create lesson failed: ${r.status}`);
  return r.json();
}

export async function createProblem(
  topicId: string,
  body: {
    title: string;
    description: string;
    type?: string;
    difficulty?: string;
    correct_answer?: string;
    options?: { text: string; is_correct: boolean }[];
  }
): Promise<DbProblem> {
  const r = await fetch(`${BASE_URL}/problems/by-topic/${topicId}`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Create problem failed: ${r.status}`);
  return r.json();
}

