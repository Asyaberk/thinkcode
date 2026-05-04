/**
 *
 * chatWithTutor(payload) → POST /tutor/chat
 *   Girdi : { problem_id, new_message, chat_history, student_code_or_answer }
 */
import { api } from './client';
import type { TutorChatRequest, TutorChatResponse } from '../types';

export async function chatWithTutor(payload: TutorChatRequest): Promise<TutorChatResponse> {
  return api.post<TutorChatResponse>('/tutor/chat', payload);
}
