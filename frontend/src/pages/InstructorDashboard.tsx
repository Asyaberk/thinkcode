import React, { useState, useEffect } from 'react';

import { Sidebar } from '../components/Sidebar';

import { cn } from '../lib/utils';

import { Section, UserRole } from '../types';

import { OverviewView, TopicAnalysisView, ProblemInsightsView, StudentPerformanceView, HintAnalyticsView, KnowledgeGapsView } from './InstructorAnalyticsViews';

import {

  Users,

  TrendingUp,

  Target,

  AlertCircle,

  BarChart,

  ChevronRight,

  Search,

  MessageSquare,

  ArrowUpRight,

  Loader2,

  Shield,

  RotateCcw,

  Clock,

  GitBranch,

} from 'lucide-react';

import {

  ComposedChart,

  Bar,

  Line,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

  ResponsiveContainer,

  Cell

} from 'recharts';

import { api } from '../api/client';

import { useInstructorClasses } from '../hooks/useInstructorClasses';

interface ClassOverview {

  totalStudents: number;

  averageScore: number;

  medianScore: number;

  stdDev: number;

  distribution: { range: string; count: number; color: string }[];

}

interface KnowledgeGap {

  topic: string;

  incorrectRate: number;

}

interface DifficultQuestion {

  title: string;

  failRate: number;

  uniqueStudents: number;

  totalAttempts: number;

  avgHints: number;

}

interface OpenResponseStats {

  averageScore: number;

  aiFeedbackSummary: string;

}

interface StudentRow {

  name: string;

  averageScore: number;

  percentile: number;

  questionsAttempted: number;

  weakTopic: string;

}

interface InstructorData {

  classOverview: ClassOverview;

  knowledgeGaps: KnowledgeGap[];

  difficultQuestions: DifficultQuestion[];

  openResponseStats: OpenResponseStats;

  students: StudentRow[];

}

interface InstructorDashboardProps {

  sections: Section[];

  onDashboardClick: () => void;

  onProblemsClick: () => void;

  onAnalyticsClick: () => void;

  onSectionSelect: (id: string) => void;

  onInstructorDashboardClick?: () => void;

  onCourseBuilderClick?: () => void;

  onFlowDesignerClick?: () => void;

  onEnrollmentManagementClick?: () => void;

  onLogout?: () => void;

  onSwitchCourse?: () => void;

  courseName?: string;

  userRole?: UserRole;

  activeCourseId?: string;

  /** Called when the instructor selects a different class — so App.tsx can sync activeCourseId. */
  onClassChange?: (classId: string) => void;

  /** Amber badge count for pending enrollment requests. */
  pendingEnrollmentsCount?: number;

}

// Letter grade bins — passing = 35 (D-)

const GRADE_BINS: { range: string; min: number; max: number; color: string }[] = [

  { range: 'A',  min: 85, max: 101, color: '#10b981' },

  { range: 'A-', min: 80, max: 85,  color: '#34d399' },

  { range: 'B+', min: 75, max: 80,  color: '#3b82f6' },

  { range: 'B',  min: 70, max: 75,  color: '#6366f1' },

  { range: 'B-', min: 65, max: 70,  color: '#8b5cf6' },

  { range: 'C+', min: 60, max: 65,  color: '#a855f7' },

  { range: 'C',  min: 55, max: 60,  color: '#f59e0b' },

  { range: 'C-', min: 50, max: 55,  color: '#f97316' },

  { range: 'D+', min: 45, max: 50,  color: '#fb923c' },

  { range: 'D',  min: 40, max: 45,  color: '#f87171' },

  { range: 'D-', min: 35, max: 40,  color: '#ef4444' },

  { range: 'F',  min: 0,  max: 35,  color: '#dc2626' },

];

// Bin midpoints (A..F order)

const GRADE_BIN_MIDS = [93, 82.5, 77.5, 72.5, 67.5, 62.5, 57.5, 52.5, 47.5, 42.5, 37.5, 17.5];

// Normal distribution PDF

const normalPDF = (x: number, mu: number, sigma: number): number =>

  sigma > 0

    ? (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2)

    : 0;

// Scale curve to tallest bar height

function addBellCurve(

  dist: { range: string; count: number; color: string }[],

  mu: number, sigma: number

): ({ range: string; count: number; color: string; bell: number })[] {

  const maxCount = Math.max(...dist.map(d => d.count), 1);

  const peakPDF  = normalPDF(mu, mu, sigma);

  return dist.map((d, i) => ({

    ...d,

    bell: peakPDF > 0

      ? parseFloat((normalPDF(GRADE_BIN_MIDS[i], mu, sigma) / peakPDF * maxCount).toFixed(2))

      : 0,

  }));

}

const LOADING_DATA: InstructorData = {

  classOverview: {

    totalStudents: 0,

    averageScore: 0,

    medianScore: 0,

    stdDev: 0,

    distribution: GRADE_BINS.map(b => ({ range: b.range, count: 0, color: b.color })),

  },

  knowledgeGaps: [],

  difficultQuestions: [],

  openResponseStats: {

    averageScore: 0,

    aiFeedbackSummary: 'Analyzing class data...',

  },

  students: [],

};

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({

  sections,

  onDashboardClick,

  onProblemsClick,

  onAnalyticsClick,

  onSectionSelect,

  onInstructorDashboardClick,

  onCourseBuilderClick,

  onFlowDesignerClick,

  onEnrollmentManagementClick,

  onLogout,

  onSwitchCourse,

  courseName,

  userRole,

  activeCourseId,
  onClassChange,
  pendingEnrollmentsCount = 0,
}) => {

  const { classes: instructorClasses, refetch: refetchClasses } = useInstructorClasses();

  const [activeClassId, setActiveClassId] = useState<string>(activeCourseId || '');

  const activeClass = instructorClasses.find(c => c.class_id === activeClassId);

  // Sync class selection up to App.tsx so CourseBanner / sidebar stay correct
  const handleClassChange = (classId: string) => {
    setActiveClassId(classId);
    onClassChange?.(classId);
  };

  useEffect(() => {

    if (instructorClasses.length > 0 && !activeClassId) {

      const firstId = activeCourseId || instructorClasses[0].class_id;
      setActiveClassId(firstId);
      onClassChange?.(firstId);

    }

  }, [instructorClasses]);

  useEffect(() => {

    if (activeCourseId) setActiveClassId(activeCourseId);

  }, [activeCourseId]);

  const PATTERN_META: Record<string, { icon: any; label: string; color: string }> = {

    mastery_gate:    { icon: Shield,    label: 'Mastery Gate',    color: 'text-purple-400' },

    socratic_retry:  { icon: RotateCcw, label: 'Socratic Retry',  color: 'text-blue-400'   },

    spaced_retrieval:{ icon: Clock,     label: 'Spaced Retrieval',color: 'text-amber-400'  },

    adaptive_branch: { icon: GitBranch, label: 'Adaptive Branch', color: 'text-emerald-400'},

  };

  // ── State ────────────────────────────────────────────────────────────────

  const [activeView, setActiveView] = useState<'overview'|'topics'|'problems'|'students'|'hints'|'gaps'>('overview');

  const [data, setData] = useState<InstructorData>(LOADING_DATA);

  const [topicHeatmap, setTopicHeatmap] = useState<any[]>([]);

  const [problemStats, setProblemStats] = useState<any[]>([]);

  const [engagementData, setEngagementData] = useState<any>(null);

  const [hintData, setHintData] = useState<any>(null);

  const [gapsData, setGapsData] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [aiReport, setAiReport] = useState<string | null>(null);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  const [problemFilter, setProblemFilter] = useState<'all'|'hard'|'easy'>('all');

  const [problemSort, setProblemSort] = useState<'pass_rate'|'attempts'>('pass_rate');

  const [studentSearch, setStudentSearch] = useState('');

  const getLetterGrade = (score: number) => {

    const bin = GRADE_BINS.find(b => score >= b.min && score < b.max);

    return bin ? { grade: bin.range, color: bin.color } : { grade: 'F', color: '#dc2626' };

  };

  useEffect(() => {

    const fetchData = async () => {

      try {

        setIsLoading(true);

        const [dashRes, studRes, heatRes, probRes, engRes, hintRes, gapRes] = await Promise.allSettled([
          api.get<any>(`/instructor/${activeClassId}/dashboard`),
          api.get<any[]>(`/instructor/${activeClassId}/students`),
          api.get<any[]>(`/instructor/${activeClassId}/topic-heatmap`),
          api.get<any[]>(`/instructor/${activeClassId}/problem-stats`),
          api.get<any>(`/instructor/${activeClassId}/engagement`),
          api.get<any>(`/instructor/${activeClassId}/hints`),
          api.get<any[]>(`/instructor/${activeClassId}/knowledge-gaps`),
        ]);

        const dashboard = dashRes.status === 'fulfilled' ? dashRes.value : {} as any;
        const students  = studRes.status === 'fulfilled' ? studRes.value : [];
        if (heatRes.status === 'fulfilled') setTopicHeatmap(heatRes.value);
        if (probRes.status === 'fulfilled') setProblemStats(probRes.value);
        if (engRes.status  === 'fulfilled') setEngagementData(engRes.value);
        if (hintRes.status === 'fulfilled') setHintData(hintRes.value);
        if (gapRes.status  === 'fulfilled') setGapsData(gapRes.value);

        const allScores = students.map((s: any) => parseFloat(s.avg_mastery) || 0);

        const scoreRanges = GRADE_BINS.map(b => ({

          range: b.range,

          count: allScores.filter(s => s >= b.min && s < b.max).length,

          color: b.color,

        }));

        // μ ve σ hesapla (yuvarlama YOK)

        const mean = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

        const variance = allScores.length ? allScores.reduce((a, b) => a + (b - mean) ** 2, 0) / allScores.length : 0;

        const stdDev = Math.sqrt(variance);

        const gapsByTopic = new Map<string, KnowledgeGap>();

        for (const g of (dashboard.knowledge_gaps || [])) {

          const topicName  = g.topic_name || 'Unknown';

          const rate       = parseFloat(g.failure_rate_pct) || 0;

          if (!gapsByTopic.has(topicName) || rate > (gapsByTopic.get(topicName)!.incorrectRate)) {

            gapsByTopic.set(topicName, { topic: topicName, incorrectRate: rate });

          }

        }

        const gaps: KnowledgeGap[] = Array.from(gapsByTopic.values())

          .sort((a, b) => b.incorrectRate - a.incorrectRate);

        const difficult: DifficultQuestion[] = (dashboard.knowledge_gaps || []).slice(0, 4).map((g: any) => ({

          title: g.problem_title || 'Unknown',

          failRate: parseFloat(g.failure_rate_pct) || 0,

          uniqueStudents: parseInt(g.unique_students) || 0,

          totalAttempts: parseInt(g.total_attempts) || 0,

          avgHints: parseFloat(g.avg_hints_per_student) || 0,

        }));

        const avgScore = parseFloat(dashboard.average_mastery) || 0;

        const studentRows: StudentRow[] = students.map((s: any, i: number) => ({

          name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || `Student ${i + 1}`,

          averageScore: parseFloat(parseFloat(s.avg_mastery || '0').toFixed(1)),

          percentile: Math.round(100 - (i / Math.max(students.length - 1, 1)) * 100),

          questionsAttempted: parseInt(s.total_attempted) || 0,

          weakTopic: s.weak_topic || s.weakest_topic || 'N/A',

        }));

        setData({

          classOverview: {

            totalStudents: dashboard.total_students || 0,

            averageScore: avgScore,

            medianScore: parseFloat(dashboard.median_mastery) || 0,

            stdDev: Math.round(stdDev * 100) / 100,

            distribution: addBellCurve(scoreRanges, mean, stdDev),

          },

          knowledgeGaps: gaps.length > 0 ? gaps : [

            { topic: 'Red-Black Trees', incorrectRate: 62 },

            { topic: 'Dijkstra\'s Algorithm', incorrectRate: 55 },

            { topic: 'Dynamic Programming', incorrectRate: 48 },

          ],

          difficultQuestions: difficult.length > 0 ? difficult : [

            { title: 'Kosaraju-Sharir SCC', failRate: 65, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

            { title: 'Left Rotation Purpose', failRate: 58, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

            { title: 'Bellman-Ford Iterations', failRate: 42, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

          ],

          openResponseStats: {

            averageScore: avgScore,

            aiFeedbackSummary:

              `Most students show strong understanding of fundamental sorting algorithms but struggle with ` +

              `advanced graph theory concepts. In particular, ${gaps[0]?.topic || 'Red-Black Trees'} shows ` +

              `a ${gaps[0]?.incorrectRate || 62}% incorrect rate — consider revisiting this topic with ` +

              `additional exercises and visual demonstrations.`,

          },

          students: studentRows,

        });

      } catch (err: any) {

        console.error('InstructorDashboard fetch error:', err);

        setError(err?.message || 'Failed to load dashboard');

        setData({

          ...LOADING_DATA,

          classOverview: {

            totalStudents: 101,

            averageScore: 52.4,

            medianScore: 50.2,

            stdDev: 18.53,

            distribution: GRADE_BINS.map((b, i) => ({

              range: b.range,

              count: [2, 3, 4, 6, 8, 11, 14, 18, 16, 12, 8, 6][i] ?? 0,

              color: b.color,

            })),

          },

          knowledgeGaps: [

            { topic: 'Red-Black Trees', incorrectRate: 62 },

            { topic: 'Dijkstra\'s Algorithm', incorrectRate: 55 },

            { topic: 'Dynamic Programming', incorrectRate: 48 },

            { topic: 'Quicksort Analysis', incorrectRate: 32 },

            { topic: 'Hash Tables', incorrectRate: 28 },

          ],

          difficultQuestions: [

            { title: 'Kosaraju-Sharir SCC First Step', failRate: 65, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

            { title: 'Left Rotation Purpose (LLRB)', failRate: 58, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

            { title: 'Bellman-Ford Iterations', failRate: 42, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

            { title: 'BST Search Average Case', failRate: 38, uniqueStudents: 0, totalAttempts: 0, avgHints: 0 },

          ],

          openResponseStats: {

            averageScore: 68,

            aiFeedbackSummary:

              'Most students understand basic sorting algorithms. Red-Black Tree invariants and graph SCC algorithms show the highest error rates. Consider additional in-class exercises on advanced data structures.',

          },

          students: [],

        });

      } finally {

        setIsLoading(false);

      }

    };

    fetchData();

  }, [activeClassId]);

  // ── AI Gap Analysis butonu ────────────────────────────────────────────────

  const handleGenerateReport = async () => {

    if (!activeClassId) return;

    try {

      setIsGeneratingReport(true);

      const result = await api.post<{ ai_analysis: string }>(`/instructor/${activeClassId}/analyze-gaps`, {});

      setAiReport(result.ai_analysis || 'No analysis available.');

    } catch (err) {

      console.error('Gap analysis error:', err);

      setAiReport('Could not generate AI report. Please try again.');

    } finally {

      setIsGeneratingReport(false);

    }

  };

  const filteredStudents = data.students.filter(s =>

    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||

    s.weakTopic.toLowerCase().includes(searchQuery.toLowerCase())

  );

  const { classOverview, knowledgeGaps, difficultQuestions, openResponseStats } = data;

  return (

    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden">

      <Sidebar

        sections={sections}

        activeSectionId="instructor-dashboard"

        onSectionSelect={onSectionSelect}

        onDashboardClick={onDashboardClick}

        onProblemsClick={onProblemsClick}

        onAnalyticsClick={onAnalyticsClick}

        onCourseBuilderClick={onCourseBuilderClick}

        onFlowDesignerClick={onFlowDesignerClick}

        onEnrollmentManagementClick={onEnrollmentManagementClick}
        pendingEnrollmentsCount={pendingEnrollmentsCount}
        onSwitchCourse={onSwitchCourse}

        onLogout={onLogout}

        userRole={userRole}

        courseName={courseName}

        activeAnalyticsView={activeView}

        onAnalyticsViewChange={(v) => setActiveView(v as any)}

        onInstructorDashboardClick={() => { setActiveView('overview'); onInstructorDashboardClick?.(); }}

      />

      <main className="flex-1 overflow-y-auto ml-72">
        <div className="p-8 max-w-6xl mx-auto space-y-6">

          {/* ── Page Header ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">
                {activeView === 'overview'  ? 'Class Overview'
                : activeView === 'topics'  ? 'Topic Analysis'
                : activeView === 'problems'? 'Problem Insights'
                : activeView === 'students'? 'Student Performance'
                : activeView === 'hints'   ? 'Hint Analytics'
                : 'Knowledge Gaps'}
              </h1>
              {courseName && <p className="text-slate-500 text-sm mt-0.5">{courseName}</p>}
            </div>
            {isLoading && <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
          </div>

          {/* ── View Router ── */}
          {activeView === 'overview' && (
            <OverviewView data={data} topicHeatmap={topicHeatmap} engagementData={engagementData} gapsData={gapsData}
              onAnalyzeGaps={handleGenerateReport} isGenerating={isGeneratingReport} aiReport={aiReport} activeClassId={activeClassId} />
          )}
          {activeView === 'topics' && <TopicAnalysisView topicHeatmap={topicHeatmap} />}
          {activeView === 'problems' && <ProblemInsightsView problemStats={problemStats} />}
          {activeView === 'students' && <StudentPerformanceView data={data} engagementData={engagementData} />}
          {activeView === 'hints' && <HintAnalyticsView hintData={hintData} />}
          {activeView === 'gaps' && (
            <KnowledgeGapsView gapsData={gapsData} onAnalyzeGaps={handleGenerateReport}
              isGenerating={isGeneratingReport} aiReport={aiReport} />
          )}

        </div>
      </main>

    </div>

  );

};

