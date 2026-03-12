import { api } from './client';
import type { Topic, ApiLesson } from '../types';

export async function getTopics(): Promise<Topic[]> {
  return api.get<Topic[]>('/topics');
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
