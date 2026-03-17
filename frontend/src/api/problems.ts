import { api } from './client';
import type { ApiProblem, Submission, SubmissionCreate } from '../types';

export async function getProblems(): Promise<ApiProblem[]> {
  return api.get<ApiProblem[]>('/problems');
}

export async function getProblem(problemId: string): Promise<ApiProblem> {
  return api.get<ApiProblem>(`/problems/${problemId}`);
}

export async function submitAnswer(payload: SubmissionCreate): Promise<Submission> {
  return api.post<Submission>('/submissions', payload);
}

export async function getSubmission(submissionId: string): Promise<Submission> {
  return api.get<Submission>(`/submissions/${submissionId}`);
}
