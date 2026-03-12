import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { LessonContent } from '../components/LessonContent';
import { AIChatbot } from '../components/AIChatbot';
import { Section, Lesson, UserRole } from '../types';

interface LearningPageProps {
  sections: Section[];
  activeSectionId: string;
  onSectionSelect: (id: string) => void;
  onDashboardClick: () => void;
  onProblemsClick: () => void;
  onAnalyticsClick: () => void;
  onPlaygroundClick?: () => void;
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
  onPlaygroundClick,
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
        onPlaygroundClick={onPlaygroundClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onLogout={onLogout}
        userRole={userRole}
      />
      
      <main className="flex-1 ml-72 overflow-y-auto relative">
        {/* Subtle Top Header */}
        <header className="sticky top-0 z-10 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            <span>Curriculum</span>
            <ChevronRight size={10} />
            <span className="text-white">{lesson.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0f172a] bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img src={`https://picsum.photos/seed/${i}/32/32`} alt="User" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">12 Students Online</span>
          </div>
        </header>

        <LessonContent lesson={lesson} onNext={onNext} />
      </main>

      <AIChatbot context={lesson.title} />
    </div>
  );
};
