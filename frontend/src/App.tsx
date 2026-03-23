/**
 * App.tsx — ThinkCode Uygulamasının Ana Giriş Noktası
 *
 * Bu dosya tüm sayfalar arasındaki YÖNLENDİRMEYİ (routing) yönetir.
 * React Router kullanılmaz; bunun yerine `currentPage` state'i sayfa geçişlerini kontrol eder.
 *
 * SAYFA HİYERARŞİSİ:
 *   login           → LoginPage      : Giriş yapılmamışsa burada kalır
 *   dashboard       → DashboardPage  : Ana menü (konu seçimi)
 *   problems        → ProblemsPage   : Soru listesi (belirli konu filtresi ile)
 *   learning        → LearningPage   : Ders içeriği + LessonContent bileşeni
 *   question        → QuestionPage   : Soru çözme (ChatQuestionInterface + CodePlayground)
 *   analytics       → AnalyticsPage  : Öğrenci kişisel analytics
 *   instructor-dashboard → InstructorDashboard : Öğretmen sınıf dashboard'u
 *
 * AUTH AKIŞI:
 *   AuthContext → user null → 'login' sayfasında tut
 *   Login başarılı → rol'e göre 'dashboard' veya 'instructor-dashboard'a yönlendir
 *
 * ÖNEMLİ STATE'LER:
 *   activeSectionId   → Hangi konu (topic) seçili (sidebar + learning için)
 *   activeQuestionId  → Hangi soru çözülüyor (QuestionPage için)
 *   currentProblems   → Seçili konunun soru listesi (ProblemsPage'e geçilir)
 *   masteryClassId    → Öğrencinin sınıf ID'si (useMastery hook'undan gelir)
 */

import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { LearningPage } from './pages/LearningPage';
import { QuestionPage } from './pages/QuestionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { useAuth } from './context/AuthContext';
import { useTopics } from './hooks/useTopics';
import { useLessonForTopic } from './hooks/useLesson';
import { useMastery } from './hooks/useMastery';  // classId icin
import { getProblemsByTopic } from './api/problems';
import type { Section, Question, ApiProblem } from './types';

type Page = 'login' | 'dashboard' | 'problems' | 'learning' | 'question' | 'analytics' | 'instructor-dashboard';

export default function App() {
  const { user, userRole, logout } = useAuth();
  const { sections, isLoading: topicsLoading } = useTopics();
  // useMastery: classId + topicMasteryMap (isCompleted icin) DB'den otomatik alir
  const { classId: masteryClassId, topicMasteryMap, topicPassedMap, topicAttemptedMap, refetch: refetchMastery } = useMastery();
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [apiQuestion, setApiQuestion] = useState<Question | null>(null);
  const classId = masteryClassId ?? '';

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

  // class_id artik useMastery hook'undan otomatik geliyor — manuel fetch kaldirildi

  // Topic değişince API'den o topic'in ilk MCQ sorusunu çek
  // Learning Path → Ders → Start Practice akışı gerçek Sedgewick sorusu gösterir
  useEffect(() => {
    if (!activeSectionId) return;
    let cancelled = false;

    getProblemsByTopic(activeSectionId)
      .then((problems: ApiProblem[]) => {
        if (cancelled || problems.length === 0) return;

        // MCQ öncelikli — varsa MCQ seç, yoksa coding, yoksa herhangi biri
        const preferred =
          problems.find(p => p.type === 'multiple_choice') ||
          problems.find(p => p.type === 'coding') ||
          problems[0];

        // Backend type → QuestionPage type eşleştirmesi
        const typeMap: Record<string, Question['type']> = {
          multiple_choice: 'Multiple Choice',
          coding:          'Coding',
          open_response:   'Open Response',
        };

        const q: Question = {
          id:          preferred.id,
          /** problemId — backend UUID, submitAnswer() API çağrısı için */
          problemId:   preferred.id,
          lessonId:    activeSectionId,
          title:       preferred.title,
          description: preferred.description,
          type:        typeMap[preferred.type] ?? 'Multiple Choice',
          // Açıklama: grading_rubric veya correct_answer kullan
          explanation: preferred.grading_rubric ||
                       preferred.correct_answer ||
                       'Review the Sedgewick textbook for this topic.',
          // Starter code: MCQ'da _ANSWER_ placeholder ekle (handleOptionSelect dolduracak)
          starterCode: preferred.starter_code ||
                       (preferred.type === 'multiple_choice'
                         ? `// ${preferred.title}\n// Select the correct option below:\n\nAnswer: _ANSWER_`
                         : `// ${preferred.title}\n// Write your solution here\n`),
          // MCQ seçenekleri: is_correct true olanı correctOptionId olarak işaretle
          options: (preferred.options || []).map(o => ({ id: o.id, text: o.text })),
          correctOptionId: (preferred.options || []).find(o => o.is_correct)?.id,
          relatedResources: [],
        };
        setApiQuestion(q);
      })
      .catch(() => {
        // API bağlanamadıysa null bırak — fallback yok, loading göster
        setApiQuestion(null);
      });
    return () => { cancelled = true; };
  }, [activeSectionId]);


  // isCompleted = passed > 0 AND passed === attempted
  // Yani: tum denenen sorularin SON denemesi dogru olmali.
  // Herhangi bir soruyu yanlis yaparsa: passed < attempted → tamamlanmamis.
  // Hic soru denememisse: attempted=0 → tamamlanmamis.
  const sectionsWithCompletion: Section[] = sections.map(s => {
    const passed = topicPassedMap[s.id] ?? 0;
    const attempted = topicAttemptedMap[s.id] ?? 0;
    return {
      ...s,
      isCompleted: (topicMasteryMap[s.id] ?? 0) >= 60,
    };
  });

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

  // currentQuestion: API'den gelen Sedgewick sorusu — async yuklenir
  // Artık mock data kullanilmiyor: her soru gercek DB'den gelir
  const currentQuestion: Question | null = apiQuestion ?? null;
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
    const currentIndex = sections.findIndex(s => s.id === activeSectionId);
    if (currentIndex < sections.length - 1) {
      setActiveSectionId(sections[currentIndex + 1].id);
      setCurrentPage('learning');
    } else {
      alert("Congratulations! You've completed all lessons.");
      setCurrentPage('dashboard');
    }
  };

  const [dashRefreshKey, setDashRefreshKey] = useState(0);

  /**
   * handleSubmission — her submission sonrasi (dogru veya yanlis) cagrilir.
   * (1) useMastery refetch — sidebar checkmark ve mastery score anlik guncellenir
   * (2) dashRefreshKey artar — DashboardPage topic mastery listesini yeniden ceker
   */
  const handleSubmission = (_isCorrect: boolean) => {
    refetchMastery();
    setDashRefreshKey(k => k + 1);
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
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
          refreshKey={dashRefreshKey}
        />
      )}

      {currentPage === 'problems' && (
        <ProblemsPage
          sections={sectionsWithCompletion}
          onProblemSelect={handleProblemSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onLearningClick={() => setCurrentPage('learning')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
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
          classId={classId}
          onBack={handleBack}
          onComplete={handleQuestionComplete}
          onSubmission={handleSubmission}   // her submission sonrasi anlik mastery refresh
        />
      )}


      {currentPage === 'analytics' && (
        <AnalyticsPage
          sections={sectionsWithCompletion}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}

      {currentPage === 'instructor-dashboard' && (
        <InstructorDashboard
          sections={sectionsWithCompletion}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}
    </div>
  );
}
