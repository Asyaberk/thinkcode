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
import { CourseBuilderPage } from './pages/CourseBuilderPage';
import { FlowDesignerPage } from './pages/FlowDesignerPage';
import { useAuth } from './context/AuthContext';
import { useTopics } from './hooks/useTopics';
import { useLessonForTopic } from './hooks/useLesson';
import { useMastery } from './hooks/useMastery';
import { useActiveFlow } from './hooks/useActiveFlow';
import { getProblemsByTopic } from './api/problems';
import { getDueSpacedReviews } from './api/flows';
import type { SpacedReviewItem } from './api/flows';
import type { Section, Question, ApiProblem } from './types';

type Page = 'login' | 'dashboard' | 'problems' | 'learning' | 'question' | 'analytics' | 'instructor-dashboard' | 'course-builder' | 'flow-designer';

export default function App() {
  const { user, userRole, logout } = useAuth();
  // useMastery: classId + topicMasteryMap (isCompleted icin) DB'den otomatik alir
  const { classId: masteryClassId, topicMasteryMap, topicPassedMap, topicAttemptedMap, refetch: refetchMastery } = useMastery();
  const classId = masteryClassId ?? '';
  // Sınıfa özel konuları çek (lesson_count ile birlikte)
  const { topics, sections, isLoading: topicsLoading } = useTopics(classId || null);

  // Aktif pedagojik flow (Flow Designer'dan deploy edilen)
  const { flow: activeFlow } = useActiveFlow(classId || null);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [apiQuestion, setApiQuestion] = useState<Question | null>(null);
  // Mastery Gate: art arda doğru sayıcı (konu değişince sıfırlanır)
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  // Tüm konu soruları (Mastery Gate 3 farklı soru için)
  const [topicQuestions, setTopicQuestions] = useState<Question[]>([]);
  // Kaçıncı sorudayiz (Mastery Gate'e özel)
  const [masteryQuestionIndex, setMasteryQuestionIndex] = useState(0);
  // Adaptive Branch: soruda hangi asamadayiz
  type AdaptivePhase = 'question_first' | 'intro_lesson' | 'advanced_lesson' | 'confirmation' | null;
  const [adaptivePhase, setAdaptivePhase] = useState<AdaptivePhase>(null);
  // Adaptive Branch: hangi soru confirmation için saklanıyor
  const [adaptiveQuestion, setAdaptiveQuestion] = useState<Question | null>(null);
  // Spaced Retrieval: bugün vadesi gelen review'lar
  const [dueReviews, setDueReviews] = useState<SpacedReviewItem[]>([]);

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

  // Set default section once topics load — lesson'ı olan ilk topic'i seç
  useEffect(() => {
    if (sections.length > 0 && !activeSectionId) {
      // lesson_count > 0 olan ilk topic'i, yoksa problem_count > 0'ı, yoksa ilk'i seç
      const withLesson  = sections.find(s => (topics.find(t => t.id === s.id)?.lesson_count ?? 0) > 0);
      const withProblem = sections.find(s => (topics.find(t => t.id === s.id)?.problem_count ?? 0) > 0);
      setActiveSectionId((withLesson ?? withProblem ?? sections[0]).id);
    }
  }, [sections, activeSectionId, topics]);

  // class_id artik useMastery hook'undan otomatik geliyor — manuel fetch kaldirildi

  // Spaced Retrieval: classId ve pattern hazırsa due review'ları çek
  useEffect(() => {
    if (!classId || activeFlow.pattern !== 'spaced_retrieval') { setDueReviews([]); return; }
    getDueSpacedReviews(classId).then(setDueReviews).catch(() => setDueReviews([]));
  }, [classId, activeFlow.pattern]); // dashRefreshKey burada OLMAMALI — daha sonra tanımlanıyor

  // Topic değişince tüm soruları çek (Mastery Gate için farklı sorular)
  useEffect(() => {
    if (!activeSectionId) return;
    let cancelled = false;

    const typeMap: Record<string, Question['type']> = {
      multiple_choice: 'Multiple Choice',
      coding:          'Coding',
      open_response:   'Open Response',
    };

    const mapProblem = (p: ApiProblem): Question => ({
      id:          p.id,
      problemId:   p.id,
      lessonId:    activeSectionId,
      title:       p.title,
      description: p.description,
      type:        typeMap[p.type] ?? 'Multiple Choice',
      explanation: p.grading_rubric || p.correct_answer || 'Review the Sedgewick textbook for this topic.',
      starterCode: p.starter_code ||
                   (p.type === 'multiple_choice'
                     ? `// ${p.title}\n// Select the correct option below:\n\nAnswer: _ANSWER_`
                     : `// ${p.title}\n// Write your solution here\n`),
      options: (p.options || []).map(o => ({ id: o.id, text: o.text })),
      correctOptionId: (p.options || []).find(o => o.is_correct)?.id,
      relatedResources: [],
    });

    getProblemsByTopic(activeSectionId)
      .then((problems: ApiProblem[]) => {
        if (cancelled || problems.length === 0) return;
        const allQ = problems.map(mapProblem);
        if (!cancelled) {
          setTopicQuestions(allQ);
          // Non-mastery flow: ilk MCQ soruyu göster
          const preferred =
            problems.find(p => p.type === 'multiple_choice') ||
            problems.find(p => p.type === 'coding') ||
            problems[0];
          setApiQuestion(mapProblem(preferred));
          setMasteryQuestionIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setApiQuestion(null);
      });
    return () => { cancelled = true; };
  }, [activeSectionId]);

  // currentQuestion: Mastery Gate ise farklı soru göster, değilse ilk MCQ

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
    title: topicsLoading
      ? 'Yükleniyor...'
      : 'Bu konu için henüz ders içeriği eklenmemiş',
    content: topicsLoading
      ? '# Yükleniyor...'
      : '# İçerik Bekleniyor\n\nBu konu için ders materyali henüz yüklenmemiş. Hoca tarafından eklenince burada görünecek.\n\nSoldaki başka bir konuya geçebilirsin.',
  };

  const currentLesson = apiLesson ?? fallbackLesson;

  const masteryThreshold = activeFlow.config.consecutive_correct ?? 3;
  const isMasteryGateActive = activeFlow.pattern === 'mastery_gate';

  // Mastery Gate: topic soruları arasında dön (cycling)
  const currentQuestion: Question | null = isMasteryGateActive && topicQuestions.length > 0
    ? topicQuestions[masteryQuestionIndex % topicQuestions.length]
    : apiQuestion;

  // Mastery Gate: sonraki soruya geç
  const handleNextMasteryQuestion = () => {
    setMasteryQuestionIndex(prev => prev + 1);
    // NOT: section değişmez, sadece soru yükselir
  };

  const handleLogin = () => { /* AuthContext handles state, useEffect handles redirect */ };

  const handleLogout = () => {
    logout();
    setCurrentPage('login');
  };

  const handleSectionSelect = async (id: string) => {
    setActiveSectionId(id);
    setActiveQuestionId(null);
    setConsecutiveCorrect(0);
    setMasteryQuestionIndex(0);
    setAdaptiveQuestion(null);

    if (activeFlow.pattern === 'adaptive_branch' && classId) {
      // Backend'den bu konu için adaptive state'i çek
      try {
        const { getAdaptiveState } = await import('./api/flows');
        const state = await getAdaptiveState(classId, id);
        if (state.diagnostic_done) {
          // Tanı tamamlandı → doğrudan atanan yolu uygula
          setAdaptivePhase(
            state.assigned_path === 'advanced' ? 'advanced_lesson' : 'intro_lesson',
          );
        } else {
          // Tanı tamamlanmadı → önce diagnostic soruları göster
          setAdaptivePhase('question_first');
        }
      } catch {
        setAdaptivePhase('question_first');
      }
    } else {
      setAdaptivePhase(null);
    }
    setCurrentPage('learning');
  };

  const handleProblemSelect = (questionId: string) => {
    setActiveQuestionId(questionId);
    setCurrentPage('question');
  };

  const handleNext = () => {
    setActiveQuestionId(null);
    // Adaptive Branch: lesson bittikten sonra confirmation sorusuna geç
    if (activeFlow.pattern === 'adaptive_branch' &&
        (adaptivePhase === 'advanced_lesson' || adaptivePhase === 'intro_lesson')) {
      setAdaptivePhase('confirmation');
      setCurrentPage('question');
      return;
    }
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
    // Adaptive Branch: advanced_lesson göstürme aşamasındaysa next section'a geç
    setConsecutiveCorrect(0);
    setMasteryQuestionIndex(0);
    setAdaptivePhase(null);
    const currentIndex = sections.findIndex(s => s.id === activeSectionId);
    if (currentIndex < sections.length - 1) {
      setActiveSectionId(sections[currentIndex + 1].id);
      // Yeni section için adaptive phase ayarla
      if (activeFlow.pattern === 'adaptive_branch') setAdaptivePhase('question_first');
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
  const handleSubmission = (isCorrect: boolean) => {
    refetchMastery();
    setDashRefreshKey(k => k + 1);

    if (activeFlow.pattern === 'mastery_gate') {
      setConsecutiveCorrect(prev => isCorrect ? prev + 1 : 0);
    }

    // Adaptive Branch: cevaba göre ders modu belirle
    if (activeFlow.pattern === 'adaptive_branch') {
      if (adaptivePhase === 'question_first' || adaptivePhase === 'confirmation') {
        // Confirmation aşamasında yanlış → intro_lesson'a geri dön
        // question_first aşamasında cevaba göre ders belirle
        if (isCorrect) {
          if (adaptivePhase === 'confirmation') {
            // Confirmation doğru → next section
            handleQuestionComplete();
          } else {
            // İlk soruyu doğru → advanced lesson
            setAdaptiveQuestion(currentQuestion);
            setAdaptivePhase('advanced_lesson');
            setTimeout(() => setCurrentPage('learning'), 350);
          }
        } else {
          // Yanlış → intro lesson (hem question_first hem confirmation için)
          setAdaptiveQuestion(currentQuestion);
          setAdaptivePhase('intro_lesson');
          setTimeout(() => setCurrentPage('learning'), 350);
        }

        // question_first bitti → backend'e bildir (path kalıcı olarak atanır)
        if (adaptivePhase === 'question_first' && classId && activeSectionId) {
          import('./api/flows').then(({ completeAdaptiveDiagnostic }) => {
            completeAdaptiveDiagnostic({
              class_id:      classId,
              topic_id:      activeSectionId,
              correct_count: isCorrect ? 1 : 0,
              total_count:   1,
            }).catch(() => {/* sessiz hata */});
          });
        }
      }
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
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onLogout={handleLogout}
          userRole={userRole}
          refreshKey={dashRefreshKey}
          classId={classId}
          dueReviews={dueReviews}
          onReviewStart={(problemId: string) => {
            // Doğrudan soruya git
            setActiveQuestionId(problemId);
            setCurrentPage('question');
          }}
        />
      )}

      {currentPage === 'problems' && (
        <ProblemsPage
          sections={sectionsWithCompletion}
          classId={classId}
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
          onComplete={handleQuestionComplete}
          flowPattern={activeFlow.pattern}
          consecutiveCorrect={consecutiveCorrect}
          masteryThreshold={activeFlow.config.consecutive_correct ?? 3}
          adaptivePhase={adaptivePhase}
        />
      )}

      {currentPage === 'question' && (
        <QuestionPage
          key={isMasteryGateActive
            ? `${activeSectionId}-${masteryQuestionIndex}`
            : adaptivePhase === 'confirmation'
              ? `${activeSectionId}-confirm`
              : activeSectionId}
          question={adaptivePhase === 'confirmation' && adaptiveQuestion ? adaptiveQuestion : currentQuestion}
          classId={classId}
          flowPattern={activeFlow.pattern}
          flowConfig={activeFlow.config}
          consecutiveCorrect={consecutiveCorrect}
          adaptivePhase={adaptivePhase}
          questionNumber={isMasteryGateActive ? masteryQuestionIndex + 1 : undefined}
          questionsTotal={isMasteryGateActive ? Math.max(topicQuestions.length, masteryThreshold) : undefined}
          onNextQuestion={isMasteryGateActive ? handleNextMasteryQuestion : undefined}
          onBack={handleBack}
          onComplete={handleQuestionComplete}
          onSubmission={handleSubmission}
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
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onCourseBuilderClick={() => setCurrentPage('course-builder')}
          onFlowDesignerClick={() => setCurrentPage('flow-designer')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}

      {currentPage === 'course-builder' && (
        <CourseBuilderPage
          sections={sectionsWithCompletion}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onCourseBuilderClick={() => setCurrentPage('course-builder')}
          onFlowDesignerClick={() => setCurrentPage('flow-designer')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}

      {currentPage === 'flow-designer' && (
        <FlowDesignerPage
          sections={sectionsWithCompletion}
          classId={classId}
          onSectionSelect={handleSectionSelect}
          onDashboardClick={() => setCurrentPage('dashboard')}
          onProblemsClick={() => setCurrentPage('problems')}
          onAnalyticsClick={() => setCurrentPage('analytics')}
          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}
          onCourseBuilderClick={() => setCurrentPage('course-builder')}
          onFlowDesignerClick={() => setCurrentPage('flow-designer')}
          onLogout={handleLogout}
          userRole={userRole}
        />
      )}
    </div>
  );
}
