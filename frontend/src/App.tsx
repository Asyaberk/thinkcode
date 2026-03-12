/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { LearningPage } from './pages/LearningPage';
import { QuestionPage } from './pages/QuestionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { questions } from './mockData';
import { useAuth } from './context/AuthContext';
import { useTopics } from './hooks/useTopics';
import { useLessonForTopic } from './hooks/useLesson';
import type { Section } from './types';

type Page = 'login' | 'dashboard' | 'problems' | 'learning' | 'question' | 'analytics' | 'playground' | 'instructor-dashboard';

export default function App() {
  const { user, userRole, logout } = useAuth();
  const { sections, isLoading: topicsLoading } = useTopics();
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  // Track completion locally (Phase D API integration will replace this)
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});

  // Restore page on session / topics load
  useEffect(() => {
    if (user) {
      if (userRole === 'Instructor') {
        setCurrentPage('instructor-dashboard');
      } else {
        setCurrentPage('dashboard');
      }
    } else {
      setCurrentPage('login');
    }
  }, [user, userRole]);

  // Set default section once topics load
  useEffect(() => {
    if (sections.length > 0 && !activeSectionId) {
      setActiveSectionId(sections[0].id);
    }
  }, [sections, activeSectionId]);

  // Sections with local completion merged in
  const sectionsWithCompletion: Section[] = sections.map(s => ({
    ...s,
    isCompleted: completionMap[s.id] ?? false,
  }));

  // Fetch lesson for current active section
  const { lesson: apiLesson } = useLessonForTopic(
    currentPage === 'learning' && activeSectionId ? activeSectionId : null
  );

  const fallbackLesson = {
    id: activeSectionId,
    sectionId: activeSectionId,
    title: topicsLoading ? 'Loading...' : 'Select a Topic',
    content: '# Loading lesson content...',
  };

  const currentLesson = apiLesson ?? fallbackLesson;
  const currentQuestion = activeQuestionId
    ? questions[activeQuestionId]
    : (questions[activeSectionId] || questions['cpp-basics']);

  const handleLogin = () => { /* AuthContext handles state, useEffect handles redirect */ };

  const handleLogout = () => {
    logout();
    setCurrentPage('login');
  };

  const handleSectionSelect = (id: string) => {
    setActiveSectionId(id);
    setActiveQuestionId(null);
    setCurrentPage('learning');
  };

  const handleProblemSelect = (questionId: string) => {
    setActiveQuestionId(questionId);
    setCurrentPage('question');
  };

  const handleNext = () => {
    setActiveQuestionId(null);
    setCurrentPage('question');
  };

  const handleBack = () => {
    if (activeQuestionId) {
      setCurrentPage('problems');
    } else {
      setCurrentPage('learning');
    }
  };

  const handleQuestionComplete = () => {
    if (activeQuestionId) {
      setCurrentPage('problems');
      return;
    }
    setCompletionMap(prev => ({ ...prev, [activeSectionId]: true }));
    const currentIndex = sections.findIndex(s => s.id === activeSectionId);
    if (currentIndex < sections.length - 1) {
      setActiveSectionId(sections[currentIndex + 1].id);
      setCurrentPage('learning');
    } else {
      alert("Congratulations! You've completed all lessons.");
      setCurrentPage('dashboard');
    }
  };

  if (currentPage === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen">
      {currentPage === 'dashboard' && (
        <DashboardPage
          sections={sectionsWithCompletion}
          onSectionSelect={handleSectionSelect}
          onProblemsClick={() => setCurrentPage('problems')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onPlaygroundClick={() => setCurrentPage('playground')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}

      {currentPage === 'problems' && (
        <ProblemsPage
          sections={sectionsWithCompletion}
          onProblemSelect={handleProblemSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onLearningClick={() => setCurrentPage('learning')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onPlaygroundClick={() => setCurrentPage('playground')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}

      {currentPage === 'learning' && (
        <LearningPage
          sections={sectionsWithCompletion}
          activeSectionId={activeSectionId}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onPlaygroundClick={() => setCurrentPage('playground')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
          lesson={currentLesson}
          onNext={handleNext}
        />
      )}

      {currentPage === 'question' && (
        <QuestionPage
          question={currentQuestion}
          onBack={handleBack}
          onComplete={handleQuestionComplete}
        />
      )}

      {currentPage === 'analytics' && (
        <AnalyticsPage
          sections={sectionsWithCompletion}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onPlaygroundClick={() => setCurrentPage('playground')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}

      {currentPage === 'playground' && (
        <PlaygroundPage
          sections={sectionsWithCompletion}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onLearningClick={() => setCurrentPage('learning')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
          isSidebarCollapsed={false}
          onToggleSidebar={() => {}}
        />
      )}

      {currentPage === 'instructor-dashboard' && (
        <InstructorDashboard
          sections={sectionsWithCompletion}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onPlaygroundClick={() => setCurrentPage('playground')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}
    </div>
  );
}
