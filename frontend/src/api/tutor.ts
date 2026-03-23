/**
 * api/tutor.ts — AI Sokratik Öğretmen Chat API
 *
 * chatWithTutor(payload) → POST /tutor/chat
 *   Girdi : { problem_id, new_message, chat_history, student_code_or_answer }
 *   Çıktı : { response, chat_history, trace_id }
 *   Kullanan: ChatQuestionInterface.tsx — chat panelindeki her gönder butonunda çağrılır
 */
import { api } from './client';
import type { TutorChatRequest, TutorChatResponse } from '../types';

export async function chatWithTutor(payload: TutorChatRequest): Promise<TutorChatResponse> {
  return api.post<TutorChatResponse>('/tutor/chat', payload);
}
