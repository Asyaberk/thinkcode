
export type UserRole = 'Student' | 'Instructor';

export type Section = {
  id: string;
  title: string;
  isCompleted: boolean;
};

export type ResourceType = 'PDF' | 'Video' | 'Link' | 'Slides';

export type Resource = {
  id: string;
  title: string;
  type: ResourceType;
  url: string;
  description: string;
};

export type Lesson = {
  id: string;
  sectionId: string;
  title: string;
  content: string; // Markdown
  resources?: Resource[];
};

export type QuestionType = 'Coding' | 'Multiple Choice' | 'Open Response' | 'Conceptual';

export type Question = {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  type: QuestionType;
  options?: {
    id: string;
    text: string;
  }[];
  correctOptionId?: string;
  starterCode?: string;
  solutionTemplate?: string;
  explanation: string;
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
