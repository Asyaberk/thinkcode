import { api } from './client';
import type { TutorChatRequest, TutorChatResponse } from '../types';

export async function chatWithTutor(payload: TutorChatRequest): Promise<TutorChatResponse> {
  return api.post<TutorChatResponse>('/tutor/chat', payload);
}
