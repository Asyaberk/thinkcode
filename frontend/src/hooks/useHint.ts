/**
 * useHint.ts — Hint isteme ve kaydetme hook'u
 *
 * QuestionPage'deki "Hint" butonuna baglidir.
 * Her hint istegini backend /tutor/chat'e gondererek:
 * - hint_requests tablosuna kayit edilir (tutor router)
 * - mastery'den hint_penalty dusulur (recompute_mastery)
 * - AI tutordan Sokrates tarzi ipucu alinir
 */
import { useState, useCallback } from 'react';
import { api } from '../api/client';

export interface HintResponse {
  response: string;      // AI tutordan gelen hint metni
  hint_level: number;    // Kacinci hint (1-indexed)
  intent: string;        // classify_intent sonucu ('hint')
}

interface UseHintResult {
  hint: string | null;
  hintCount: number;
  isLoadingHint: boolean;
  error: string | null;
  requestHint: (problemId: string, currentCode: string) => Promise<HintResponse | null>;
}

export function useHint(): UseHintResult {
  const [hint, setHint] = useState<string | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);

  const requestHint = useCallback(async (
    problemId: string,
    currentCode: string
  ): Promise<HintResponse | null> => {
    setIsLoadingHint(true);
    setError(null);
    try {
      // POST /api/v1/tutor/chat — intent='hint' mesaji ile
      // Backend classify_intent 'hint' olarak algilar ve hint_requests'e kaydeder
      const response = await api.post<{
        response: string;
        chat_history: { role: string; content: string }[];
        trace_id: string | null;
      }>('/tutor/chat', {
        problem_id: problemId,
        new_message: 'Can you give me a hint?',  // hint keyword'u intent=hint tetikler
        chat_history: chatHistory,
        student_code_or_answer: currentCode,
      });

      const newHintCount = hintCount + 1;
      setHint(response.response);
      setHintCount(newHintCount);
      setChatHistory(response.chat_history);

      return {
        response: response.response,
        hint_level: newHintCount,
        intent: 'hint',
      };
    } catch (err: any) {
      setError(err.message ?? 'Hint request failed');
      return null;
    } finally {
      setIsLoadingHint(false);
    }
  }, [hintCount, chatHistory]);

  return { hint, hintCount, isLoadingHint, error, requestHint };
}
