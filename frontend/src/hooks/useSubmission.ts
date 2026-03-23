/**
 * useSubmission.ts — Cevap gonderme ve sonuc yonetimi
 *
 * QuestionPage'in Check Solution akisini yonetir:
 * - MCQ: selected_option_id gonderer
 * - Coding: submitted_code gonderer
 * - Open Response: submitted_answer gonderer
 * Backend'den gelen feedback ve score'u state'e kaydeder.
 * Mastery guncelleme backend'de otomatik tetiklenir (submissions.py).
 */
import { useState, useCallback } from 'react';
import { api } from '../api/client';

export interface SubmissionResult {
  id: string;
  is_correct: boolean;
  score: number | null;
  max_score: number | null;
  status: string;
  feedback: string | null;
  attempt_number: number;
}

interface SubmitPayload {
  problem_id: string;
  class_id?: string;
  selected_option_id?: string;
  submitted_code?: string;
  submitted_answer?: string;
  time_spent_seconds?: number;
}

interface UseSubmissionResult {
  result: SubmissionResult | null;
  isSubmitting: boolean;
  error: string | null;
  submit: (payload: SubmitPayload) => Promise<SubmissionResult>;
  reset: () => void;
}

export function useSubmission(): UseSubmissionResult {
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: SubmitPayload): Promise<SubmissionResult> => {
    setIsSubmitting(true);
    setError(null);
    try {
      // POST /api/v1/submissions — class_id artik optional (backend enrollment'dan alir)
      const response = await api.post<SubmissionResult>('/submissions', payload);
      setResult(response);
      return response;
    } catch (err: any) {
      const msg = err.message ?? 'Submission failed';
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isSubmitting, error, submit, reset };
}
