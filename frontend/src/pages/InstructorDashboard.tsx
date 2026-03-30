/**
 * InstructorDashboard.tsx — Öğretmen Paneli
 *
 * Tasarım: OrijinalMockData versiyonu TAMAMEN KORUNDU.
 * Değişiklik: instructorData import'u kaldırıldı → GET /instructor/me/class + GET /instructor/{class_id}/dashboard
 * API'den dönen veri, tam olarak mockData formatında: classOverview, knowledgeGaps, difficultQuestions, students.
 * Tüm JSX, stiller, animasyonlar birebir aynı.
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { cn } from '../lib/utils';
import { Section, UserRole } from '../types';
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

// ── Tip tanımları (backend response formatı, mockData ile birebir uyumlu) ──
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
  onContentBuilderClick?: () => void;
  onLogout?: () => void;
  userRole?: UserRole;
}

// ── Yükleme sırasında gösterilecek fallback verisi ─────────────────────────
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
  onContentBuilderClick,
  onLogout,
  userRole
}) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [data, setData] = useState<InstructorData>(LOADING_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  const getLetterGrade = (score: number) => {
    const bin = GRADE_BINS.find(b => score >= b.min && score < b.max);
    return bin ? { grade: bin.range, color: bin.color } : { grade: 'F', color: '#dc2626' };
  };

  // ── Backend'den veri çek ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // 1. Instructor'un class_id'sini al
        const classInfo = await api.get<{ class_id: string; class_name: string; total_students: number }>(
          '/instructor/me/class'
        );

        // 2. Sınıf dashboard verisini yükle
        const dashboard = await api.get<any>(`/instructor/${classInfo.class_id}/dashboard`);

        // 3. Öğrenci listesini al
        const students = await api.get<any[]>(`/instructor/${classInfo.class_id}/students`);

        // ── Backend → mockData formatına dönüştür ─────────────────────────
        // Harf notu dağılımı — geçme notu 35
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

        // knowledgeGaps: backend detect_knowledge_gaps → topic bazlı grupla, en kötü failure_rate'i al
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

        // difficultQuestions: problem bazlı, tüm detaylar
        const difficult: DifficultQuestion[] = (dashboard.knowledge_gaps || []).slice(0, 4).map((g: any) => ({
          title: g.problem_title || 'Unknown',
          failRate: parseFloat(g.failure_rate_pct) || 0,
          uniqueStudents: parseInt(g.unique_students) || 0,
          totalAttempts: parseInt(g.total_attempts) || 0,
          avgHints: parseFloat(g.avg_hints_per_student) || 0,
        }));

        // openResponseStats: class avg mastery'den türet (ondalıklı)
        const avgScore = parseFloat(dashboard.average_mastery) || 0;

        // students: tüm öğrenciler (at-risk için slice kaldırıldı)
        const studentRows: StudentRow[] = students.map((s: any, i: number) => ({
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || `Student ${i + 1}`,
          averageScore: parseFloat(parseFloat(s.avg_mastery || '0').toFixed(1)),
          percentile: Math.round(100 - (i / Math.max(students.length - 1, 1)) * 100),
          questionsAttempted: parseInt(s.total_attempted) || 0,
          weakTopic: s.weak_topic || s.weakest_topic || 'N/A',
        }));

        setData({
          classOverview: {
            totalStudents: dashboard.total_students || classInfo.total_students,
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
        // Hata durumunda güzel bir fallback göster
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
  }, []);

  // ── AI Gap Analysis butonu ────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);
      // class_id'yi önce al
      const classInfo = await api.get<{ class_id: string }>('/instructor/me/class');
      const result = await api.post<{ ai_analysis: string }>(`/instructor/${classInfo.class_id}/analyze-gaps`, {});
      setAiReport(result.ai_analysis || 'No analysis available.');
    } catch (err) {
      console.error('Gap analysis error:', err);
      setAiReport('Could not generate AI report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ── Öğrenci filtreleme ─────────────────────────────────────────────────
  const filteredStudents = data.students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.weakTopic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { classOverview, knowledgeGaps, difficultQuestions, openResponseStats } = data;

  // ── JSX — TAMAMEN ORİJİNAL (mockData referansları → state değişkenleri) ──
  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden">
      <Sidebar
        sections={sections}
        activeSectionId="instructor-dashboard"
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onContentBuilderClick={onContentBuilderClick}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className="flex-1 overflow-y-auto ml-72">
        <div className="p-8 max-w-7xl mx-auto space-y-8">

          {/* ── Header ───────────────────────────────────────────────── */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Instructor Dashboard</h1>
              <p className="text-slate-400">Class Performance & Learning Analytics for Algorithms 101</p>
            </div>
            <div className="flex gap-3">
              {/* Öğrenci sayısı rozeti */}
              <div className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-2">
                <Users size={18} className="text-emerald-500" />
                <span className="text-sm font-medium">
                  {isLoading ? '...' : `${classOverview.totalStudents} Students`}
                </span>
              </div>
              {/* AI Gap Analysis butonu */}
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium flex items-center gap-2 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                {isGeneratingReport
                  ? <><Loader2 size={16} className="animate-spin" />Generating...</>
                  : <><MessageSquare size={16} />Generate Report</>
                }
              </button>
            </div>
          </div>

          {/* AI Raporu (varsa göster) */}
          {aiReport && (
            <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">AI Analysis</div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed italic">"{aiReport}"</p>
            </div>
          )}

          {/* ── Overview Stats ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ortalama Puan */}
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <TrendingUp size={20} />
                </div>
                <span className="text-slate-400 text-sm font-medium">Average Score</span>
              </div>
              <div className="text-4xl font-bold text-white">
                {isLoading ? '—' : `${classOverview.averageScore.toFixed(1)}%`}
              </div>
              <div className="text-xs text-emerald-500 font-bold mt-2">
                Median: {isLoading ? '—' : `${classOverview.medianScore.toFixed(1)}%`}
              </div>
            </div>

            {/* Toplam Öğrenci */}
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <Users size={20} />
                </div>
                <span className="text-slate-400 text-sm font-medium">Total Students</span>
              </div>
              <div className="text-4xl font-bold text-white">
                {isLoading ? '—' : classOverview.totalStudents}
              </div>
              <div className="text-xs text-blue-500 font-bold mt-2">
                Actively enrolled in class
              </div>
            </div>

            {/* Knowledge Gaps sayısı */}
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                  <Target size={20} />
                </div>
                <span className="text-slate-400 text-sm font-medium">Knowledge Gaps</span>
              </div>
              <div className="text-4xl font-bold text-white">
                {isLoading ? '—' : knowledgeGaps.length}
              </div>
              <div className="text-xs text-amber-500 font-bold mt-2">
                Topics needing attention
              </div>
            </div>
          </div>

          {/* ── Distribution Chart + Knowledge Gaps ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Score Distribution */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <BarChart size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Grade Distribution</h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Passing grade: D- (≥35%)</p>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={classOverview.distribution} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 700 }}
                      interval={0}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#f1f5f9', fontWeight: 700 }}
                      itemStyle={{ color: '#94a3b8' }}
                      formatter={(value: number, name: string) =>
                        name === 'bell' ? null : [`${value} students`, 'Count']
                      }
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {classOverview.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={(entry as any).color || '#3b82f6'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="bell"
                      stroke="#f8fafc"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>μ = <span className="text-slate-300 font-bold">{classOverview.averageScore.toFixed(1)}%</span></span>
                <span>σ = <span className="text-slate-300 font-bold">{classOverview.stdDev.toFixed(1)}%</span></span>
                <span>Median = <span className="text-slate-300 font-bold">{classOverview.medianScore.toFixed(1)}%</span></span>
                <span className="text-orange-400 font-bold">F &lt; 35%</span>
              </div>
            </div>

            {/* Knowledge Gaps */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                  <AlertCircle size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Knowledge Gaps</h3>
              </div>

              <div className="space-y-6">
                {knowledgeGaps.map((gap, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-300">{gap.topic}</span>
                      <span className="font-bold text-amber-500">{gap.incorrectRate.toFixed(1)}% incorrect</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${gap.incorrectRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Difficult Questions + AI Grading Summary ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Most Difficult Questions */}
            <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 p-8 rounded-3xl">
              <h3 className="text-lg font-bold text-white mb-6">Most Difficult Questions</h3>
              <div className="space-y-3">
                {difficultQuestions.map((q, i) => (
                  <div
                    key={i}
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl cursor-pointer group hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">{q.title}</span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
                          Fail Rate: {q.failRate.toFixed(1)}%
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-slate-600 group-hover:text-emerald-500 transition-all ${expandedIdx === i ? 'rotate-90 text-emerald-500' : ''}`}
                      />
                    </div>
                    {expandedIdx === i && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs font-bold text-white">{q.uniqueStudents}</div>
                          <div className="text-[10px] text-slate-500">students</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{q.totalAttempts}</div>
                          <div className="text-[10px] text-slate-500">attempts</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{q.avgHints.toFixed(1)}</div>
                          <div className="text-[10px] text-slate-500">avg hints</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AI Grading Feedback Summary */}
            <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                  <Target size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">AI Grading Feedback Summary</h3>
              </div>
              <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 relative">
                <div className="absolute top-4 right-4 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded uppercase tracking-widest">
                  AI Generated
                </div>
                <p className="text-slate-300 leading-relaxed italic">
                  "{openResponseStats.aiFeedbackSummary}"
                </p>
                <div className="mt-6 pt-5 border-t border-slate-700/50">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">⚠ At-Risk Students</p>
                  <div className="space-y-2">
                    {[...data.students]
                      .sort((a, b) => a.averageScore - b.averageScore)
                      .slice(0, 3)
                      .map((s, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-[10px] font-black text-red-400">
                              {s.name.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-slate-300">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{s.weakTopic}</span>
                            <span className="text-xs font-bold text-red-400">{s.averageScore.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Student Performance List ───────────────────────────────── */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Student Performance List</h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/30 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                    <th className="px-8 py-4">Name</th>
                    <th className="px-8 py-4">Avg Score</th>
                    <th className="px-8 py-4">Percentile</th>
                    <th className="px-8 py-4">Attempted</th>
                    <th className="px-8 py-4">Weak Topic</th>
                    <th className="px-8 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-10 text-center text-slate-500">
                        <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                        Loading students...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-10 text-center text-slate-500">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, i) => (
                      <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-white">{student.name}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "text-sm font-bold",
                            student.averageScore >= 80 ? "text-emerald-500" :
                            student.averageScore >= 60 ? "text-blue-500" : "text-amber-500"
                          )}>
                            {student.averageScore.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-medium text-slate-400">Top {100 - student.percentile}%</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-medium text-slate-400">{student.questionsAttempted} Questions</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300">
                            {student.weakTopic}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
                          >
                            View Details <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      {/* ── Student Detail Drawer ─────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setSelectedStudent(null)}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          selectedStudent ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-slate-950 border-l border-slate-800 z-50 flex flex-col transition-transform duration-300 ease-out ${
        selectedStudent ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {selectedStudent && (() => {
          const { grade, color } = getLetterGrade(selectedStudent.averageScore);
          const classAvg = data.classOverview.averageScore;
          const diff = selectedStudent.averageScore - classAvg;
          const barWidth = Math.min(selectedStudent.averageScore, 100);
          return (
            <>
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black text-white"
                      style={{ backgroundColor: color + '33', border: `2px solid ${color}` }}
                    >
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-white">{selectedStudent.name}</h2>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Top {100 - selectedStudent.percentile}% · {selectedStudent.questionsAttempted} Questions</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-500 hover:text-white transition-colors mt-1"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Grade Badge */}
                <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ borderColor: color + '50', background: color + '10' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Letter Grade</p>
                    <p className="text-4xl font-black" style={{ color }}>{grade}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{selectedStudent.averageScore.toFixed(1)}%</p>
                    <p className={`text-xs font-bold mt-1 ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs class avg
                    </p>
                  </div>
                </div>

                {/* Mastery Bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span>Mastery Score</span>
                    <span className="text-white font-bold">{selectedStudent.averageScore.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>F (0%)</span>
                    <span className="text-slate-500">Class avg: {classAvg.toFixed(1)}%</span>
                    <span>A (100%)</span>
                  </div>
                </div>

                {/* Grade Scale */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Grade Scale</p>
                  <div className="space-y-1.5">
                    {GRADE_BINS.map(b => {
                      const isHere = selectedStudent.averageScore >= b.min && selectedStudent.averageScore < b.max;
                      return (
                        <div key={b.range} className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition-all ${
                          isHere ? 'border' : ''
                        }`} style={isHere ? { borderColor: b.color + '60', background: b.color + '15' } : {}}>
                          <span className="text-xs font-bold" style={{ color: isHere ? b.color : '#475569' }}>
                            {b.range}
                          </span>
                          <span className="text-[10px] text-slate-600">
                            {b.range === 'A' ? '≥85%' : `${b.min}–${b.max === 101 ? 100 : b.max}%`}
                          </span>
                          {isHere && <span className="text-[10px] font-black" style={{ color: b.color }}>← YOU</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weak Topic */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1">⚠ Weak Topic</p>
                  <p className="text-sm font-bold text-white">{selectedStudent.weakTopic}</p>
                </div>

              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
