/**

 *

 * KULLANIM:

 *   getProblemsByTopic(topicId)  → /problems?topic_id=...  — ProblemsPage + App.tsx

 *   submitAnswer(payload)        → POST /submissions        — useSubmission hook

 *   getSolvedProblemIds()        → /submissions/me/solved-problem-ids — App.tsx sidebar

 */

import { api } from './client';

import type { ApiProblem, Submission, SubmissionCreate } from '../types';

export async function getProblems(): Promise<ApiProblem[]> {

  return api.get<ApiProblem[]>('/problems');

}

export async function getProblemsByTopic(topicId: string): Promise<ApiProblem[]> {

  return api.get<ApiProblem[]>(`/problems?topic_id=${topicId}`);

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

/**

 * Kullanicinin daha once dogru cevapladigi problem_id'lerini Set olarak doner.

 * Backend: GET /api/v1/submissions/me/solved-problem-ids

 */

export async function getSolvedProblemIds(): Promise<Set<string>> {

  const data = await api.get<{ solved_problem_ids: string[] }>('/submissions/me/solved-problem-ids');

  return new Set(data.solved_problem_ids);

}

