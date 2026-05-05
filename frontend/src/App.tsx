/**

 *

 *   login              → LoginPage

 *   dashboard          → DashboardPage

 *   problems           → ProblemsPage

 *   learning           → LearningPage

 *   question           → QuestionPage

 *   analytics          → AnalyticsPage

 *   instructor-dashboard → InstructorDashboard

 *

 * activeCourseId localStorage'da tutulur — yenilemede kaybolmaz.

 */

import { useState, useEffect, useMemo } from 'react';

import { LoginPage } from './pages/LoginPage';

import { CourseSelectionPage } from './pages/CourseSelectionPage';

import { CourseDiscoveryPage } from './pages/CourseDiscoveryPage';

import { DashboardPage } from './pages/DashboardPage';

import { ProblemsPage } from './pages/ProblemsPage';

import { LearningPage } from './pages/LearningPage';

import { QuestionPage } from './pages/QuestionPage';

import { AnalyticsPage } from './pages/AnalyticsPage';

import { InstructorDashboard } from './pages/InstructorDashboard';

import { CourseBuilderPage } from './pages/CourseBuilderPage';

import { FlowDesignerPage } from './pages/FlowDesignerPage';

import { EnrollmentManagementPage } from './pages/EnrollmentManagementPage';

import { CourseBanner } from './components/CourseBanner';

import { useAuth } from './context/AuthContext';

import { useTopics } from './hooks/useTopics';

import { useLessonForTopic } from './hooks/useLesson';

import { useMastery } from './hooks/useMastery';

import { useActiveFlow } from './hooks/useActiveFlow';

import { useCourses, enrollCourse, unenrollCourse, createCourse, updateCourse, deleteCourse, listEnrollments } from './hooks/useCourses';

import { getProblemsByTopic } from './api/problems';

import { getDueSpacedReviews } from './api/flows';

import type { SpacedReviewItem } from './api/flows';

import type { Section, Question, ApiProblem, Course } from './types';

type Page =

  | 'login'

  | 'course-selection'

  | 'dashboard'

  | 'problems'

  | 'learning'

  | 'question'

  | 'analytics'

  | 'instructor-dashboard'

  | 'course-builder'

  | 'flow-designer'

  | 'enrollment-management'

  | 'course-discovery';

// localStorage helper

const STORAGE_KEY = 'tc_active_course_id';

export default function App() {

  const { user, userRole, logout, token } = useAuth();

  // ── Core hooks — classId driven by activeCourseId (student's selected course) ──

  // Read from localStorage directly so classId is correct on first render

  const _storedCourseId = localStorage.getItem('tc_active_course_id') || '';

  const { classId: masteryClassId, topicMasteryMap, topicPassedMap, topicAttemptedMap, refetch: refetchMastery } = useMastery(_storedCourseId || undefined);

  // Effective classId: prefer actively selected course, fall back to first enrollment

  const classId = _storedCourseId || masteryClassId || '';

  const { topics, sections, isLoading: topicsLoading } = useTopics(classId || null);

  const { flow: activeFlow } = useActiveFlow(classId || null);

  const [currentPage, setCurrentPage] = useState<Page>('login');

  const [activeSectionId, setActiveSectionId] = useState<string>('');

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const [apiQuestion, setApiQuestion] = useState<Question | null>(null);

  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);

  const [topicQuestions, setTopicQuestions] = useState<Question[]>([]);

  const [masteryQuestionIndex, setMasteryQuestionIndex] = useState(0);

  type AdaptivePhase = 'question_first' | 'intro_lesson' | 'advanced_lesson' | 'confirmation' | null;

  const [adaptivePhase, setAdaptivePhase] = useState<AdaptivePhase>(null);

  const [adaptiveQuestion, setAdaptiveQuestion] = useState<Question | null>(null);

  const [dueReviews, setDueReviews] = useState<SpacedReviewItem[]>([]);

  const [dashRefreshKey, setDashRefreshKey] = useState(0);

  // activeCourseId localStorage'da tutulur — yenilemede kaybolmaz

  const [activeCourseId, setActiveCourseId] = useState<string>(

    () => localStorage.getItem(STORAGE_KEY) || ''

  );

  const { courses: allCourses, enrolledCourseIds, pendingCourseIds, refetch: refetchCourses } = useCourses(userRole, token);

  // Global pending enrollment count — shown as amber badge on all instructor sidebar pages
  const [pendingEnrollmentsCount, setPendingEnrollmentsCount] = useState(0);

  useEffect(() => {
    if (userRole !== 'Instructor' || !activeCourseId || !token) return;
    listEnrollments(activeCourseId, token, 'pending')
      .then(data => setPendingEnrollmentsCount(data.length))
      .catch(() => setPendingEnrollmentsCount(0));
  }, [userRole, activeCourseId, token]);


  const handleEnroll = async (courseId: string) => {

    if (!token) return;

    try {

      await enrollCourse(courseId, token);

      await refetchCourses();  // refetch from DB — shows true pending state

    } catch (err: any) {

      console.error('Enroll failed:', err);

    }

  };

  const activeCourse = useMemo(

    () => allCourses.find(c => c.id === activeCourseId),

    [allCourses, activeCourseId]

  );

  const courseName = activeCourse?.name;

  const handleCourseSelect = (courseId: string) => {

    setActiveCourseId(courseId);

    localStorage.setItem(STORAGE_KEY, courseId);

    if (userRole === 'Instructor') {

      setCurrentPage('instructor-dashboard');

    } else {

      setCurrentPage('dashboard');

    }

  };

  // After instructor deploys a flow to a class → switch active course to that class

  const handleDeploySuccess = (deployedClassId: string) => {

    setActiveCourseId(deployedClassId);

    localStorage.setItem(STORAGE_KEY, deployedClassId);

    setCurrentPage('instructor-dashboard');

  };

  const handleUnenroll = async (courseId: string) => {

    if (!token) return;

    try {

      await unenrollCourse(courseId, token);

      await refetchCourses();

    } catch (err: any) {

      console.error('Unenroll failed:', err);

    }

  };

  const handleAddCourse = async (formData: any) => {

    if (!token) return;

    try {

      await createCourse({

        name:          formData.name,

        code:          formData.code,

        description:   formData.description,

        semester:      formData.term,

        color:         formData.color,

        thumbnail_url: formData.thumbnail,

        tags:          formData.tags,

      }, token);

      await refetchCourses();

    } catch (err: any) {

      console.error('Create course failed:', err);

      alert(`Course could not be created: ${err.message}`);

    }

  };

  const handleEditCourse = async (course: Course) => {

    if (!token) return;

    try {

      await updateCourse(course.id, {

        name:          course.name,

        code:          course.code,

        description:   course.description,

        semester:      course.term,

        color:         course.color,

        thumbnail_url: course.thumbnail,

        tags:          (course as any).tags,

      }, token);

      await refetchCourses();

    } catch (err: any) {

      console.error('Update course failed:', err);

      alert(`Course could not be updated: ${err.message}`);

    }

  };

  const handleDeleteCourse = async (courseId: string) => {

    if (!token) return;

    if (!confirm('Are you sure you want to delete this course?')) return;

    try {

      await deleteCourse(courseId, token);

      await refetchCourses();

    } catch (err: any) {

      console.error('Delete course failed:', err);

      alert(`Kurs silinemedi: ${err.message}`);

    }

  };

  const handleSwitchCourse = () => setCurrentPage('course-selection');

  useEffect(() => {

    if (!user) {

      setCurrentPage('login');

      return;

    }

    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {

      if (userRole === 'Instructor') {

        setCurrentPage('instructor-dashboard');

      } else {

        setCurrentPage('dashboard');

      }

    } else {

      setCurrentPage('course-selection');

    }

  }, [user, userRole]);

  useEffect(() => {

    if (sections.length > 0 && !activeSectionId) {

      const withLesson  = sections.find(s => (topics.find(t => t.id === s.id)?.lesson_count ?? 0) > 0);

      const withProblem = sections.find(s => (topics.find(t => t.id === s.id)?.problem_count ?? 0) > 0);

      setActiveSectionId((withLesson ?? withProblem ?? sections[0]).id);

    }

  }, [sections, activeSectionId, topics]);

  useEffect(() => {

    if (!classId || activeFlow.pattern !== 'spaced_retrieval') { setDueReviews([]); return; }

    getDueSpacedReviews(classId).then(setDueReviews).catch(() => setDueReviews([]));

  }, [classId, activeFlow.pattern]);

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

          const preferred =

            problems.find(p => p.type === 'multiple_choice') ||

            problems.find(p => p.type === 'coding') ||

            problems[0];

          setApiQuestion(mapProblem(preferred));

          setMasteryQuestionIndex(0);

        }

      })

      .catch(() => { if (!cancelled) setApiQuestion(null); });

    return () => { cancelled = true; };

  }, [activeSectionId]);

  const sectionsWithCompletion: Section[] = sections.map(s => ({

    ...s,

    isCompleted: (topicMasteryMap[s.id] ?? 0) >= 60,

  }));

  const { lesson: apiLesson } = useLessonForTopic(

    currentPage === 'learning' && activeSectionId ? activeSectionId : null

  );

  const fallbackLesson = {

    id: activeSectionId,

    sectionId: activeSectionId,

    title: topicsLoading ? 'Loading...' : 'No lesson content added for this topic yet',

    content: topicsLoading

      ? '# Loading...'

      : '# Content Pending\n\nNo lesson material has been uploaded for this topic yet.\n\nSelect another topic from the sidebar.',

  };

  const currentLesson = apiLesson ?? fallbackLesson;

  const masteryThreshold = activeFlow.config.consecutive_correct ?? 3;

  const isMasteryGateActive = activeFlow.pattern === 'mastery_gate';

  const currentQuestion: Question | null = isMasteryGateActive && topicQuestions.length > 0

    ? topicQuestions[masteryQuestionIndex % topicQuestions.length]

    : apiQuestion;

  const handleNextMasteryQuestion = () => setMasteryQuestionIndex(prev => prev + 1);

  const handleLogin = () => {};

  const handleLogout = () => {

    logout();

    localStorage.removeItem(STORAGE_KEY);

    setActiveCourseId('');

    setCurrentPage('login');

  };

  const handleSectionSelect = async (id: string) => {

    setActiveSectionId(id);

    setActiveQuestionId(null);

    setConsecutiveCorrect(0);

    setMasteryQuestionIndex(0);

    setAdaptiveQuestion(null);

    if (activeFlow.pattern === 'adaptive_branch' && classId) {

      try {

        const { getAdaptiveState } = await import('./api/flows');

        const state = await getAdaptiveState(classId, id);

        if (state.diagnostic_done) {

          setAdaptivePhase(state.assigned_path === 'advanced' ? 'advanced_lesson' : 'intro_lesson');

        } else {

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

    setConsecutiveCorrect(0);

    setMasteryQuestionIndex(0);

    setAdaptivePhase(null);

    const currentIndex = sections.findIndex(s => s.id === activeSectionId);

    if (currentIndex < sections.length - 1) {

      setActiveSectionId(sections[currentIndex + 1].id);

      if (activeFlow.pattern === 'adaptive_branch') setAdaptivePhase('question_first');

      setCurrentPage('learning');

    } else {

      alert("Congratulations! You've completed all lessons.");

      setCurrentPage('dashboard');

    }

  };

  const handleSubmission = (isCorrect: boolean) => {

    refetchMastery();

    setDashRefreshKey(k => k + 1);

    if (activeFlow.pattern === 'mastery_gate') {

      setConsecutiveCorrect(prev => isCorrect ? prev + 1 : 0);

    }

    if (activeFlow.pattern === 'adaptive_branch') {

      if (adaptivePhase === 'question_first' || adaptivePhase === 'confirmation') {

        if (isCorrect) {

          if (adaptivePhase === 'confirmation') {

            handleQuestionComplete();

          } else {

            setAdaptiveQuestion(currentQuestion);

            setAdaptivePhase('advanced_lesson');

            setTimeout(() => setCurrentPage('learning'), 350);

          }

        } else {

          setAdaptiveQuestion(currentQuestion);

          setAdaptivePhase('intro_lesson');

          setTimeout(() => setCurrentPage('learning'), 350);

        }

        if (adaptivePhase === 'question_first' && classId && activeSectionId) {

          import('./api/flows').then(({ completeAdaptiveDiagnostic }) => {

            completeAdaptiveDiagnostic({

              class_id:      classId,

              topic_id:      activeSectionId,

              correct_count: isCorrect ? 1 : 0,

              total_count:   1,

            }).catch(() => {});

          });

        }

      }

    }

  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (currentPage === 'login') {

    return <LoginPage onLogin={handleLogin} />;

  }

  // Yeni: Course Selection (sadece bu blok eklendi)

  if (currentPage === 'course-selection') {

    return (

      <CourseSelectionPage

        courses={allCourses}

        enrolledCourseIds={enrolledCourseIds}

        pendingCourseIds={pendingCourseIds}

        userRole={userRole}

        onCourseSelect={handleCourseSelect}

        onEnroll={handleEnroll}

        onUnenroll={handleUnenroll}

        onAddCourse={handleAddCourse}

        onEditCourse={handleEditCourse}

        onDeleteCourse={handleDeleteCourse}

        onLogout={handleLogout}

        onDiscover={() => setCurrentPage('course-discovery')}

      />

    );

  }

  if (currentPage === 'course-discovery') {

    return (

      <CourseDiscoveryPage

        enrolledCourseIds={enrolledCourseIds}

        pendingCourseIds={pendingCourseIds}

        onEnroll={async (courseId) => {

           await handleEnroll(courseId);

           setCurrentPage('course-selection');

        }}

        onBack={() => setCurrentPage('course-selection')}

      />

    );

  }

  // All in-course pages share the same layout: Sidebar (fixed) + CourseBanner + page content

  const IN_COURSE_PAGES: Page[] = ['dashboard','problems','learning','analytics','instructor-dashboard','course-builder','flow-designer','enrollment-management'];

  const isInCoursePage = IN_COURSE_PAGES.includes(currentPage);

  return (

    <div className="min-h-screen">

      {/* ── CourseBanner — shown above ALL in-course pages ──────────────── */}

      {isInCoursePage && activeCourse && (

        <div className="fixed top-0 left-0 right-0 z-30">

          <CourseBanner

            courseName={activeCourse.name}

            courseCode={activeCourse.code}

            courseColor={activeCourse.color}

            thumbnail={activeCourse.thumbnail}

            onLogout={handleLogout}

            onSwitchCourse={handleSwitchCourse}

          />

        </div>

      )}

      {/* Offset content below banner when in-course */}

      <div className={isInCoursePage && activeCourse ? 'pt-[180px]' : ''}>

      {currentPage === 'dashboard' && (

        <DashboardPage

          sections={sectionsWithCompletion}

          onSectionSelect={handleSectionSelect}

          onProblemsClick={() => setCurrentPage('problems')}

          onAnalyticsClick={() => setCurrentPage('analytics')}

          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}

          onLogout={handleLogout}

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

          refreshKey={dashRefreshKey}

          classId={classId}

          dueReviews={dueReviews}

          onReviewStart={(problemId: string) => {

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

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

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

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

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

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

          activeCourseId={activeCourseId}

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

          onEnrollmentManagementClick={() => setCurrentPage('enrollment-management')}

          onLogout={handleLogout}

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

          activeCourseId={activeCourseId}

          onClassChange={(classId) => {
            setActiveCourseId(classId);
            localStorage.setItem(STORAGE_KEY, classId);
          }}

          pendingEnrollmentsCount={pendingEnrollmentsCount}
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

          onEnrollmentManagementClick={() => setCurrentPage('enrollment-management')}

          onLogout={handleLogout}

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

          activeCourseId={activeCourseId}
          pendingEnrollmentsCount={pendingEnrollmentsCount}
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

          onEnrollmentManagementClick={() => setCurrentPage('enrollment-management')}

          onLogout={handleLogout}

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

          onDeploySuccess={handleDeploySuccess}
          pendingEnrollmentsCount={pendingEnrollmentsCount}
        />

      )}

      {currentPage === 'enrollment-management' && (

        <EnrollmentManagementPage

          sections={sectionsWithCompletion}

          classId={activeCourseId}

          onSectionSelect={handleSectionSelect}

          onDashboardClick={() => setCurrentPage('dashboard')}

          onInstructorDashboardClick={() => setCurrentPage('instructor-dashboard')}

          onCourseBuilderClick={() => setCurrentPage('course-builder')}

          onFlowDesignerClick={() => setCurrentPage('flow-designer')}

          onEnrollmentManagementClick={() => setCurrentPage('enrollment-management')}

          onLogout={handleLogout}

          onSwitchCourse={handleSwitchCourse}

          userRole={userRole}

          courseName={courseName}

          token={token}

        />

      )}

      </div>{/* end pt-[180px] wrapper */}

    </div>

  );

}

