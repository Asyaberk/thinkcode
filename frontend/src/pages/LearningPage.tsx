import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { LessonContent } from '../components/LessonContent';
import { Section, Lesson, UserRole } from '../types';

interface LearningPageProps {
  sections: Section[];
  activeSectionId: string;
  onSectionSelect: (id: string) => void;
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onInstructorDashboardClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
  lesson: Lesson;
  onNext: () => void;
}

export const LearningPage: React.FC<LearningPageProps> = ({
  sections,
  activeSectionId,
  onSectionSelect,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onInstructorDashboardClick,
  onLogout,
  userRole,
  lesson,
  onNext,
}) => {
  return (
    <div className="flex h-screen bg-[#0f172a]">
      <Sidebar
        sections={sections}
        activeSectionId={activeSectionId}
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
        progressPercent={sections.length > 0 ? Math.round((sections.filter(s => s.isCompleted).length / sections.length) * 100) : 0}
      />
      
      <main className="flex-1 ml-72 overflow-y-auto relative">
        {/* Subtle Top Header */}
        <header className="sticky top-0 z-10 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            <span>Curriculum</span>
            <ChevronRight size={10} />
            <span className="text-white">{lesson.title}</span>
          </div>
        </header>

        <LessonContent lesson={lesson} onNext={onNext} />
      </main>

    </div>
  );
};
