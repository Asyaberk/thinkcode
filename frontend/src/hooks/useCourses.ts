/**

 * useCourses.ts

 *

 *

 *

 */

import { useState, useEffect, useCallback } from 'react';

import type { Course, UserRole } from '../types';

import { getCourseVisuals } from '../mockCourses';

const BASE_URL = '/api/v1';

interface ApiClass {

  class_id:          string;

  class_name:        string;

  class_code:        string;

  semester:          string;

  instructor_name:   string;

  total_students:    number;

  is_enrolled:       boolean;

  enrollment_status: string | null;  // 'pending' | 'active' | 'rejected' | null

  description?:      string | null;

  color?:            string | null;

  thumbnail_url?:    string | null;

  tags?:             string | null;

}

function mapApiClassToCourse(cls: ApiClass, role: UserRole): Course {

  const visuals = getCourseVisuals(cls.class_code);

  return {

    id:               cls.class_id,

    name:             cls.class_name,

    code:             cls.class_code,

    description:      cls.description || visuals.description,

    role,

    instructorName:   cls.instructor_name,

    term:             cls.semester || 'Current Term',

    studentsCount:    cls.total_students,

    color:            cls.color || visuals.color,

    thumbnail:        cls.thumbnail_url || visuals.thumbnail,

    tags:             cls.tags || '',

    progress:         0,

    enrollmentStatus: cls.enrollment_status ?? null,  // 'pending' | 'active' | 'rejected' | null

  };

}

function authHeaders(token: string) {

  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

}

export async function enrollCourse(classId: string, token: string): Promise<{ status: string }> {

  const res = await fetch(`${BASE_URL}/classes/${classId}/enroll`, {

    method: 'POST',

    headers: { Authorization: `Bearer ${token}` },

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

  return res.json();

}

export async function unenrollCourse(classId: string, token: string): Promise<void> {

  const res = await fetch(`${BASE_URL}/classes/${classId}/enroll`, {

    method: 'DELETE',

    headers: { Authorization: `Bearer ${token}` },

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

}

// Enrollment management (instructor)

export interface EnrollmentRecord {

  enrollment_id: string;

  student_id:    string;

  first_name:    string;

  last_name:     string;

  email:         string;

  status:        string;

  requested_at:  string | null;

  enrolled_at:   string | null;

}

export async function listEnrollments(

  classId: string, token: string, filter?: string

): Promise<EnrollmentRecord[]> {

  const qs = filter ? `?enrollment_status_filter=${filter}` : '';

  const res = await fetch(`${BASE_URL}/classes/${classId}/enrollments${qs}`, {

    headers: { Authorization: `Bearer ${token}` },

  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return res.json();

}

export async function approveEnrollment(classId: string, enrollmentId: string, token: string): Promise<void> {

  const res = await fetch(`${BASE_URL}/classes/${classId}/enrollments/${enrollmentId}/approve`, {

    method: 'PATCH',

    headers: { Authorization: `Bearer ${token}` },

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

}

export async function rejectEnrollment(classId: string, enrollmentId: string, token: string): Promise<void> {

  const res = await fetch(`${BASE_URL}/classes/${classId}/enrollments/${enrollmentId}/reject`, {

    method: 'PATCH',

    headers: { Authorization: `Bearer ${token}` },

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

}

export interface CourseCreateData {

  name:           string;

  code:           string;

  description?:   string;

  semester?:      string;

  color?:         string;

  thumbnail_url?: string;

}

export async function createCourse(data: CourseCreateData, token: string): Promise<ApiClass> {

  const res = await fetch(`${BASE_URL}/classes`, {

    method: 'POST',

    headers: authHeaders(token),

    body: JSON.stringify(data),

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

  return res.json();

}

export async function updateCourse(classId: string, data: Partial<CourseCreateData>, token: string): Promise<ApiClass> {

  const res = await fetch(`${BASE_URL}/classes/${classId}`, {

    method: 'PUT',

    headers: authHeaders(token),

    body: JSON.stringify(data),

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

  return res.json();

}

export async function deleteCourse(classId: string, token: string): Promise<void> {

  const res = await fetch(`${BASE_URL}/classes/${classId}`, {

    method: 'DELETE',

    headers: { Authorization: `Bearer ${token}` },

  });

  if (!res.ok && res.status !== 204) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

}

export async function searchCourses(query: string, token: string): Promise<Course[]> {

  const params = new URLSearchParams({ q: query });

  const res = await fetch(`${BASE_URL}/classes/search?${params}`, {

    headers: authHeaders(token),

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    throw new Error(body.detail || `HTTP ${res.status}`);

  }

  const data: ApiClass[] = await res.json();

  // We assume search is done mostly by Students, or role agnostic. 

  // It returns standard course info.

  return data.map(cls => mapApiClassToCourse(cls, 'Student'));

}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**

 * @param userRole  - 'Student' veya 'Instructor'

 */

export function useCourses(userRole: UserRole, token: string | null) {

  const [courses, setCourses]               = useState<Course[]>([]);

  const [enrolledCourseIds, setEnrolledIds] = useState<string[]>([]);

  const [pendingCourseIds, setPendingIds]   = useState<string[]>([]);

  const [isLoading, setIsLoading]           = useState(false);

  const [error, setError]                   = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {

    if (!token) return;

    setIsLoading(true);

    setError(null);

    const endpoint = userRole === 'Instructor' ? '/classes/my' : '/classes/all';

    try {

      const res = await fetch(`${BASE_URL}${endpoint}`, {

        headers: { Authorization: `Bearer ${token}` },

      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ApiClass[] = await res.json();

      setCourses(data.map(cls => mapApiClassToCourse(cls, userRole)));

      setEnrolledIds(data.filter(c => c.is_enrolled).map(c => c.class_id));

      setPendingIds(data.filter(c => c.enrollment_status === 'pending').map(c => c.class_id));

    } catch (err: any) {

      console.error('[useCourses] fetch failed:', err);

      setError(err.message);

    } finally {

      setIsLoading(false);

    }

  }, [userRole, token]);

  useEffect(() => {

    fetchCourses();

  }, [fetchCourses]);

  return { courses, enrolledCourseIds, pendingCourseIds, isLoading, error, refetch: fetchCourses };

}

