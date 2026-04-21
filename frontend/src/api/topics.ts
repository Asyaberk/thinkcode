/**
 * api/topics.ts — Konu ve Ders API çağrıları
 *
 * KULLANIM:
 *   getTopics()                  → GET /topics        — useTopics hook üzerinden tüm uygulamaya dağıtılır
 *   getTopicLessons(topicId)     → GET /topics/{id}/lessons — useLesson hook
 *   getLesson(lessonId)          → GET /lessons/{id}  — useLesson hook (materyal detayı için)
 */
import { api } from './client';
import type { Topic, ApiLesson } from '../types';

export async function getTopics(classId?: string): Promise<Topic[]> {
  const qs = classId ? `?class_id=${classId}` : '';
  return api.get<Topic[]>(`/topics${qs}`);
}

export async function getTopic(topicId: string): Promise<Topic> {
  return api.get<Topic>(`/topics/${topicId}`);
}

export async function getTopicLessons(topicId: string): Promise<ApiLesson[]> {
  return api.get<ApiLesson[]>(`/topics/${topicId}/lessons`);
}

export async function getLesson(lessonId: string): Promise<ApiLesson> {
  return api.get<ApiLesson>(`/lessons/${lessonId}`);
}
