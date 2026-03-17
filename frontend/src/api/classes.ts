import { api } from './client';

export interface ClassInfo {
  id: string;
  name: string;
  instructor_id: string;
  semester?: string;
}

export async function getMyClasses(): Promise<ClassInfo[]> {
  return api.get<ClassInfo[]>('/classes/my');
}
