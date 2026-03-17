import { api } from './client';

export interface HintResponse {
  level: number;
  content: string;
  max_level: number;
  trace_id?: string | null;
}

export async function requestHint(submissionId: string): Promise<HintResponse> {
  return api.post<HintResponse>(`/submissions/${submissionId}/hint`);
}
