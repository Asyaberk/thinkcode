// ── Auth ──────────────────────────────────────────────────────────────────────

/**

 *

 *

 *   Topic           → Backend'den gelen konu verisi (book_chapter, parent_topic_id vb.)

 *   ApiProblem      → Backend /problems endpoint'inden gelen ham soru verisi

 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole = 'Student' | 'Instructor';

export interface AuthUser {

  id: string;

  email: string;

  first_name: string;

  last_name: string;

  role: 'student' | 'instructor' | 'admin';

}

// ── Topics / Sections ─────────────────────────────────────────────────────────

export type Section = {

  id: string;

  title: string;

  isCompleted: boolean;

  parentId: string | null;

};

export interface Topic {

  id: string;

  name: string;

  description: string;

  book_chapter: string;

  book_url: string;

  display_order: number;

  parent_topic_id: string | null;

  lesson_count: number;    // Backend'den geliyor

  problem_count: number;   // Backend'den geliyor

}

// ── Lessons & Materials ───────────────────────────────────────────────────────

export type ResourceType = 'pdf' | 'video' | 'link' | 'visualization' | 'PDF' | 'Video' | 'Link' | 'Slides';

export type Resource = {

  id: string;

  title: string;

  type: ResourceType;

  url: string;

  description: string;

};

export interface Material {

  id: string;

  lesson_id: string;

  title: string;

  type: ResourceType;

  url: string;

  description: string;

  display_order: number;

}

export type Lesson = {

  id: string;

  sectionId: string;

  title: string;

  content: string;

  resources?: Resource[];

};

export interface ApiLesson {

  id: string;

  topic_id: string;

  title: string;

  summary: string | null;

  content_markdown: string | null;

  estimated_minutes: number;

  display_order: number;

  princeton_section: string | null;

  materials?: Material[];

}

// ── Problems ──────────────────────────────────────────────────────────────────

export type QuestionType = 'Coding' | 'Multiple Choice' | 'Open Response' | 'Conceptual';

export interface ProblemOption {

  id: string;

  problem_id: string;

  text: string;

  is_correct: boolean;

  display_order: number;

}

export interface ApiProblem {

  id: string;

  topic_id: string;

  lesson_id: string | null;

  title: string;

  description: string;

  type: 'coding' | 'multiple_choice' | 'open_response';

  difficulty: 'easy' | 'medium' | 'hard';

  starter_code: string | null;

  grading_rubric: string | null;

  correct_answer: string | null;

  points: number;

  book_reference: string | null;

  is_published: boolean;

  options?: ProblemOption[];

}

export type Question = {

  id: string;

  /** Backend UUID — submitAnswer() API cagrisi icin gerekli */

  problemId?: string;

  lessonId: string;

  title: string;

  description: string;

  type: QuestionType;

  options?: { id: string; text: string }[];

  correctOptionId?: string;

  starterCode?: string;

  solutionTemplate?: string;

  explanation: string;

  /** Dogru cevap puani — submission output mesajinda gosterilir */

  points?: number;

  relatedResources?: Resource[];

};

export type Problem = {

  id: string;

  title: string;

  difficulty: 'Easy' | 'Medium' | 'Hard';

  type: QuestionType;

  topic: string;

  status: 'Solved' | 'Unsolved';

  attempts: number;

  questionId: string;

};

// ── Submissions ───────────────────────────────────────────────────────────────

export interface SubmissionCreate {

  problem_id: string;

  class_id: string;

  submitted_code?: string;

  submitted_answer?: string;

  selected_option_id?: string;

  time_spent_seconds?: number;

}

export interface Submission {

  id: string;

  student_id: string;

  problem_id: string;

  class_id: string;

  status: 'pending' | 'passed' | 'failed' | 'grading';

  score: number | null;

  max_score: number | null;

  is_correct: boolean | null;

  attempt_number: number;

  submitted_at: string;

  feedback?: string;

}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface MasteryEntry {

  topic_id: string;

  topic_name: string;

  mastery_score: number;

  problems_attempted: number;

  problems_passed: number;

  total_hints_used: number;

}

export interface StudentDashboard {

  student_id: string;

  class_id: string;

  class_name: string;

  rank: number;

  total_students_in_class: number;

  overall_mastery: number;

  problems_attempted: number;

  problems_passed: number;

  mastery_by_topic: MasteryEntry[];

}

// ── Tutor ─────────────────────────────────────────────────────────────────────

export interface TutorMessage {

  role: 'user' | 'assistant';

  content: string;

}

export interface TutorChatRequest {

  problem_id: string;

  new_message: string;

  chat_history: TutorMessage[];

  student_code_or_answer?: string;

}

export interface TutorChatResponse {

  response: string;

  chat_history: TutorMessage[];

  trace_id?: string;

}

// ── Chat (UI-level) ───────────────────────────────────────────────────────────

export type ChatMessage = {

  id: string;

  role: 'user' | 'assistant';

  content: string;

  timestamp: number;

};

export type UserProgress = {

  completedSections: string[];

  currentSectionId: string;

};

// ── Courses ───────────────────────────────────────────────────────────────────

export type Course = {

  id: string;                    // class_id (UUID)

  name: string;                  // class_name

  code: string;                  // class_code e.g. "CMPE211"

  description: string;

  role: UserRole;                // 'Student' | 'Instructor'

  instructorName: string;

  term: string;                  // semester string e.g. "Spring 2025"

  studentsCount?: number;

  activeStudentsCount?: number;

  progress?: number;

  thumbnail?: string;

  certificateImage?: string;

  color: string;                 // hex renk

  tags?: string;

  enrollmentStatus?: string | null; // 'pending' | 'active' | 'rejected' | null

};

export interface BasePageProps {

  sections: Section[];

  courses?: Course[];

  activeCourseId?: string;

  activeCourse?: Course;

  onCourseChange?: (id: string) => void;

  onSectionSelect: (id: string) => void;

  onLogout: () => void;

  onSwitchCourse?: () => void;

  courseName?: string;

  userRole: UserRole;

}

