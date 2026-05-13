/**
 * chatWithTutor(payload)  → POST /tutor/chat
 * getTutorSession(id)     → GET  /tutor/session/{problem_id}
 */
import { api } from './client';
import type { TutorChatRequest, TutorChatResponse } from '../types';

export async function chatWithTutor(payload: TutorChatRequest): Promise<TutorChatResponse> {
  return api.post<TutorChatResponse>('/tutor/chat', payload);
}

/** Fetches the persisted conversation history for a student on a given problem. */
export async function getTutorSession(problemId: string): Promise<{
  messages: { role: string; content: string }[];
  hint_count: number;
}> {
  return api.get(`/tutor/session/${problemId}`);
}
