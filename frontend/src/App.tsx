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
import { sections as mockSections, lessons, questions } from './mockData';
import { useAuth } from './context/AuthContext';
import type { Section } from './types';

type Page = 'login' | 'dashboard' | 'problems' | 'learning' | 'question' | 'analytics' | 'playground' | 'instructor-dashboard';

export default function App() {
  const { user, userRole, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [activeSectionId, setActiveSectionId] = useState(mockSections[0].id);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [userSections, setUserSections] = useState<Section[]>(mockSections);

  // Restore page on session resume
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

  const handleLogin = () => {
    // AuthContext sets the user; useEffect above handles redirect
  };

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
    setUserSections(prev =>
      prev.map(s => s.id === activeSectionId ? { ...s, isCompleted: true } : s)
    );
    const currentIndex = userSections.findIndex(s => s.id === activeSectionId);
    if (currentIndex < userSections.length - 1) {
      setActiveSectionId(userSections[currentIndex + 1].id);
      setCurrentPage('learning');
    } else {
      alert("Congratulations! You've completed all lessons.");
      setCurrentPage('dashboard');
    }
  };

  const currentLesson = lessons[activeSectionId] || lessons['cpp-basics'];
  const currentQuestion = activeQuestionId
    ? questions[activeQuestionId]
    : (questions[activeSectionId] || questions['cpp-basics']);

  if (currentPage === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen">
      {currentPage === 'dashboard' && (
        <DashboardPage
          sections={userSections}
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
          sections={userSections}
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
          sections={userSections}
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
          sections={userSections}
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
          sections={userSections}
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
          sections={userSections}
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
