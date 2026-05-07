import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Cell } from 'recharts';
import { BookOpen, Target, Users, Lightbulb, AlertTriangle, TrendingUp, Activity, Search, ChevronUp, ChevronDown, X, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

const card = "bg-slate-900 border border-slate-800 rounded-2xl p-6";
const badge = (color: string) => `text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${color}`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (s: number) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';
const ScoreBar = ({ val, max = 100 }: { val: number; max?: number }) => (
  <div className="w-full h-1.5 rounded-full bg-slate-800 mt-1">
    <div className="h-1.5 rounded-full" style={{ width: `${(val / max) * 100}%`, backgroundColor: scoreColor(val) }} />
  </div>
);

// ── Page Banner ───────────────────────────────────────────────────────────────
const PageBanner = ({ icon, title, description, legendItems }: {
  icon: string; title: string; description: string;
  legendItems?: { dot: string; label: string }[];
}) => (
  <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/60 p-5 flex gap-4 items-start">
    <div className="text-2xl shrink-0 mt-0.5">{icon}</div>
    <div className="flex-1 min-w-0">
      <h2 className="text-sm font-black text-white mb-1">{title}</h2>
      <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
      {legendItems && legendItems.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3">
          {legendItems.map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
export const OverviewView = ({ data, topicHeatmap, engagementData, gapsData, onAnalyzeGaps, isGenerating, aiReport, activeClassId }: any) => {
  const { classOverview } = data;
  const trend = engagementData?.daily_trend?.slice(-14) ?? [];
  const worstTopics = [...(topicHeatmap ?? [])].sort((a, b) => (a.avg_mastery ?? 100) - (b.avg_mastery ?? 100)).slice(0, 3);
  return (
    <div className="space-y-6">
      <PageBanner
        icon="📊"
        title="Class Overview — Your Course at a Glance"
        description="A single-screen summary of your class health. See how many students are active, where the class average stands, and which topics are creating the most friction — all in one view. Use this data to inform your teaching strategy and adjust your course materials."
        legendItems={[
          { dot: '#10b981', label: '≥70% Mastered' },
          { dot: '#f59e0b', label: '50–69% In Progress' },
          { dot: '#ef4444', label: '<50% Needs Work' },
        ]}
      />
      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: classOverview.totalStudents, color: 'text-blue-400' },
          { label: 'Class Avg Mastery', value: `${Math.round(classOverview.averageScore)}%`, color: 'text-emerald-400' },
          { label: 'Active This Week', value: engagementData?.active_7d ?? '—', color: 'text-amber-400' },
          { label: 'Passive Students', value: engagementData?.never_active ?? '—', color: 'text-rose-400' },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={card}>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-3xl font-black ${color}`}>{value}</div>
          </motion.div>
        ))}
      </div>
      {/* Submission trend */}
      {trend.length > 0 && (
        <div className={card}>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14} /> Submission Activity (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#475569" fontSize={10} tickFormatter={d => d.slice(5)} />
              <YAxis stroke="#475569" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="total_submissions" stroke="#10b981" fill="url(#tg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Weakest topics preview */}
      {worstTopics.length > 0 && (
        <div className={card}>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-rose-400" /> Topics Needing Attention</h3>
          <div className="space-y-3">
            {worstTopics.map((t: any) => (
              <div key={t.topic_id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{t.topic_name}</span>
                    <span className="font-black" style={{ color: scoreColor(t.avg_mastery ?? 0) }}>{Math.round(t.avg_mastery ?? 0)}%</span>
                  </div>
                  <ScoreBar val={t.avg_mastery ?? 0} />
                </div>
                <span className="text-[9px] text-slate-500">{t.students_attempted ?? 0} students</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* AI analysis */}
      <div className={card + ' border-amber-500/20'}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14} /> AI Knowledge Gap Analysis</h3>
          <button onClick={onAnalyzeGaps} disabled={isGenerating} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all disabled:opacity-50">
            {isGenerating ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
        {aiReport ? <p className="text-slate-300 text-sm leading-relaxed italic">"{aiReport}"</p> : <p className="text-slate-500 text-sm">Click "Run Analysis" to get AI-powered pedagogical insights for this class.</p>}
      </div>
    </div>
  );
};

// ── TOPIC ANALYSIS ───────────────────────────────────────────────────────────
export const TopicAnalysisView = ({ topicHeatmap }: any) => {
  const topics = [...(topicHeatmap ?? [])].sort((a, b) => (a.avg_mastery ?? 0) - (b.avg_mastery ?? 0));
  return (
    <div className="space-y-4">
      <PageBanner
        icon="📚"
        title="Topic Analysis — Class Mastery by Topic"
        description="Average mastery score and pass rate per topic across all students. Red bars signal where the class is struggling most — consider revisiting your explanation, adding more exercises, or improving example quality for those topics. Sorted from weakest to strongest."
        legendItems={[
          { dot: '#10b981', label: '≥70% — İyi' },
          { dot: '#f59e0b', label: '50–69% — Gelişiyor' },
          { dot: '#ef4444', label: '<50% — Müdahale Gerekli' },
        ]}
      />
      <div className={card}>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><BookOpen size={14} /> Topic Mastery Heatmap</h3>
        <p className="text-slate-500 text-xs mb-4">Class average mastery per topic — sorted from weakest to strongest</p>
        {topics.length === 0 ? <p className="text-slate-600 text-sm">No topic data available.</p> : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {topics.map((t: any, i: number) => {
              const m = Math.round(t.avg_mastery ?? 0);
              const pr = Math.round(t.class_pass_rate ?? 0);
              const col = scoreColor(m);
              return (
                <div key={t.topic_id ?? i} className="grid grid-cols-[1fr_80px_80px_70px] gap-3 items-center p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/40 transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-slate-200 mb-1">{t.topic_name}</div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 rounded-full" style={{ width: `${m}%`, backgroundColor: col }} /></div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-black" style={{ color: col }}>{m}%</div>
                    <div className="text-[9px] text-slate-600">avg mastery</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-300">{pr}%</div>
                    <div className="text-[9px] text-slate-600">pass rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-400">{t.students_attempted ?? 0}</div>
                    <div className="text-[9px] text-slate-600">students</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── PROBLEM INSIGHTS ─────────────────────────────────────────────────────────
export const ProblemInsightsView = ({ problemStats }: any) => {
  const [filter, setFilter] = useState<'all' | 'hard' | 'easy'>('all');
  const [search, setSearch] = useState('');
  const filtered = (problemStats ?? []).filter((p: any) => {
    if (filter === 'hard' && (p.pass_rate ?? 100) >= 50) return false;
    if (filter === 'easy' && (p.pass_rate ?? 0) < 70) return false;
    if (search && !p.problem_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="space-y-4">
      <PageBanner
        icon="🎯"
        title="Problem Insights — Pass Rates & Difficulty Analysis"
        description="Real pass rate for every problem compared against its expected difficulty label. A positive .Difficulty Gap. means the problem is harder than its label suggests — consider adding hints, splitting it into sub-problems, or updating its difficulty rating. Sorted hardest to easiest."
        legendItems={[
          { dot: '#10b981', label: 'Easy (beklenen ≥70% geçme)' },
          { dot: '#f59e0b', label: 'Medium (beklenen ≥50% geçme)' },
          { dot: '#ef4444', label: 'Hard (beklenen ≥30% geçme)' },
        ]}
      />
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Target size={14} /> Problem Pass Rates</h3>
          <div className="flex items-center gap-2">
            <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 w-36 outline-none" /></div>
            {(['all', 'hard', 'easy'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>{f}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_60px_70px_70px_70px] gap-2 px-3 mb-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
          <span>Problem</span><span className="text-center">Diff</span><span className="text-center">Pass %</span><span className="text-center">Students</span><span className="text-center">Hints/S</span>
        </div>
        <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
          {filtered.length === 0 ? <p className="text-slate-600 text-sm py-4 text-center">No problems match the filter.</p> : filtered.map((p: any, i: number) => {
            const pr = p.pass_rate ?? 0;
            const col = scoreColor(pr);
            const gap = p.difficulty_gap ?? 0;
            return (
              <div key={p.problem_id ?? i} className="grid grid-cols-[1fr_60px_70px_70px_70px] gap-2 items-center p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/40 transition-colors">
                <div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{p.problem_title}</div>
                  <div className="text-[10px] text-slate-500">{p.topic_name}</div>
                </div>
                <div className="text-center"><span className={badge(p.difficulty === 'hard' ? 'bg-rose-500/20 text-rose-400' : p.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400')}>{p.difficulty ?? '?'}</span></div>
                <div className="text-center">
                  <div className="text-xs font-black" style={{ color: col }}>{pr}%</div>
                  {gap > 10 && <div className="text-[9px] text-rose-400">+{Math.round(gap)} harder</div>}
                </div>
                <div className="text-center text-xs text-slate-400">{p.unique_students ?? 0}</div>
                <div className="text-center text-xs text-slate-400">{(p.avg_hints_per_student ?? 0).toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── STUDENT HISTORY MODAL ────────────────────────────────────────────────────
const StudentHistoryModal = ({ student, classId, onClose }: { student: any; classId?: string; onClose: () => void }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!student?.id) { setError('No student ID available.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    // Use the correct token key the app stores — 'access_token'
    const token = localStorage.getItem('access_token') || '';
    const qs = classId ? `?class_id=${classId}` : '';
    fetch(`/api/v1/analytics/students/${student.id}/history${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`${r.status}: ${text}`);
        }
        return r.json();
      })
      .then(d => {
        setHistory(Array.isArray(d) ? d : []);
        // Auto-expand all topics on load
        if (Array.isArray(d)) setExpanded(new Set(d.map((t: any) => t.topic_id)));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [student?.id, classId]);

  const toggleTopic = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalWrong   = history.reduce((n, t) => n + t.wrong_count, 0);
  const totalAttempts = history.reduce((n, t) => n + t.total_attempts, 0);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      />
      {/* Slide-over */}
      <motion.aside
        key="panel"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 h-full w-[520px] max-w-full bg-[#0f172a] border-l border-slate-800 z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Student History</p>
            <h2 className="text-lg font-bold text-white">{student.name}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-slate-400">
                <span className="font-bold text-white">{totalAttempts}</span> total attempts
              </span>
              <span className="text-xs text-rose-400">
                <span className="font-bold">{totalWrong}</span> wrong
              </span>
              <span className="text-xs text-emerald-400">
                <span className="font-bold">{totalAttempts - totalWrong}</span> correct
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-slate-400">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Loading history…
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <XCircle size={36} className="mx-auto mb-3 text-rose-500 opacity-60" />
              <p className="text-rose-400 text-sm font-bold">Failed to load</p>
              <p className="text-slate-600 text-xs mt-1 font-mono break-all px-4">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-slate-600 py-16">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
              <p>No submissions found for this student.</p>
            </div>
          ) : history.map((topic: any) => {
            const isOpen = expanded.has(topic.topic_id);
            const wrongPct = topic.total_attempts > 0
              ? Math.round((topic.wrong_count / topic.total_attempts) * 100) : 0;
            const barCol = wrongPct >= 60 ? '#ef4444' : wrongPct >= 30 ? '#f59e0b' : '#10b981';
            return (
              <div key={topic.topic_id} className="rounded-2xl border border-slate-800 overflow-hidden">
                {/* Topic header row */}
                <button
                  onClick={() => toggleTopic(topic.topic_id)}
                  className="w-full flex items-center gap-3 p-4 bg-slate-900/70 hover:bg-slate-800/60 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white truncate">{topic.topic_name}</span>
                      {topic.wrong_count > 0 && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400">
                          {topic.wrong_count} wrong
                        </span>
                      )}
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-full h-1 bg-slate-800 rounded-full">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${100 - wrongPct}%`, backgroundColor: barCol }}
                      />
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-slate-500">{topic.problem_count} problems</span>
                      <span className="text-[10px] text-slate-500">{topic.total_attempts} attempts</span>
                      <span className="text-[10px] text-emerald-500">{topic.correct_count} solved</span>
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`text-slate-600 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Problem rows */}
                {isOpen && (
                  <div className="border-t border-slate-800 divide-y divide-slate-800/60">
                    {topic.problems.map((p: any) => (
                      <div key={p.problem_id} className="flex items-center gap-3 px-4 py-3 bg-slate-950/50 hover:bg-slate-800/30 transition-colors">
                        {/* Correct / Wrong icon */}
                        {p.ever_correct
                          ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          : <XCircle       size={15} className="text-rose-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-200 truncate">{p.problem_title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              p.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400'
                              : p.difficulty === 'hard' ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-amber-500/10 text-amber-400'
                            }`}>{p.difficulty}</span>
                            <span className="text-[10px] text-slate-500">{p.attempts} attempt{p.attempts !== 1 ? 's' : ''}</span>
                            {p.wrong_attempts > 0 && (
                              <span className="text-[10px] text-rose-400">{p.wrong_attempts} wrong</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black" style={{ color: scoreColor(p.ever_correct ? (p.best_score / p.max_score) * 100 : 0) }}>
                            {p.ever_correct ? `${Math.round((p.best_score / p.max_score) * 100)}%` : '—'}
                          </div>
                          {p.last_attempt_at && (
                            <div className="text-[9px] text-slate-600">
                              {new Date(p.last_attempt_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

// ── STUDENT PERFORMANCE ───────────────────────────────────────────────────────
type SortKey = 'score' | 'attempted' | 'passed' | 'weakTopic';

export const StudentPerformanceView = ({ data, engagementData, activeClassId }: any) => {
  const [search, setSearch]           = useState('');
  const [sortKey, setSortKey]         = useState<SortKey>('score');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'top' | 'mid' | 'low'>('all');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const activeNames = new Set(
    (engagementData?.top_active_students ?? []).map((s: any) => `${s.first_name} ${s.last_name}`)
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="opacity-20"><ChevronDown size={10} /></span>;
    return sortDir === 'desc' ? <ChevronDown size={10} className="text-emerald-400" /> : <ChevronUp size={10} className="text-emerald-400" />;
  };

  const getPassed = (s: any) =>
    s.questionsAttempted > 0 ? Math.round(s.questionsAttempted * (s.averageScore / 100)) : 0;

  const allStudents = (data?.students ?? []) as any[];
  const totalCount  = allStudents.length;

  // Score percentile boundaries
  const sorted25  = [...allStudents].sort((a, b) => b.averageScore - a.averageScore);
  const top25Cutoff = sorted25[Math.floor(totalCount * 0.25) - 1]?.averageScore ?? 100;
  const low25Cutoff = sorted25[Math.floor(totalCount * 0.75) - 1]?.averageScore ?? 0;

  const students = allStudents
    .filter((s: any) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      const isActive = activeNames.has(s.name);
      if (scoreFilter === 'top' && s.averageScore < top25Cutoff) return false;
      if (scoreFilter === 'low' && s.averageScore > low25Cutoff) return false;
      if (scoreFilter === 'mid' && (s.averageScore >= top25Cutoff || s.averageScore <= low25Cutoff)) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      let diff = 0;
      if (sortKey === 'score')    diff = b.averageScore - a.averageScore;
      if (sortKey === 'attempted') diff = b.questionsAttempted - a.questionsAttempted;
      if (sortKey === 'passed')   diff = getPassed(b) - getPassed(a);
      if (sortKey === 'weakTopic') diff = (a.weakTopic ?? '').localeCompare(b.weakTopic ?? '');
      return sortDir === 'desc' ? diff : -diff;
    });

  const ColHeader = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <button
      onClick={() => handleSort(k)}
      className={`flex items-center gap-1 hover:text-slate-300 transition-colors ${sortKey === k ? 'text-emerald-400' : ''} ${className}`}
    >
      {label}<SortIcon k={k} />
    </button>
  );

  return (
    <div className="space-y-4">
      {selectedStudent && (
        <StudentHistoryModal
          student={selectedStudent}
          classId={activeClassId}
          onClose={() => setSelectedStudent(null)}
        />
      )}
      <PageBanner
        icon="👥"
        title="Student Performance — Rankings & Engagement"
        description="All students ranked by mastery score. Click any column header to sort ascending or descending. Use the filters to narrow by activity level or performance tier. A green dot means the student was active in the last 7 days."
        legendItems={[
          { dot: '#10b981', label: 'Active — practiced in last 7 days' },
          { dot: '#334155', label: 'Passive — no recent activity' },
        ]}
      />
      <div className={card}>
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 shrink-0">
            <Users size={14} /> Student Rankings
          </h3>
          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student…"
              className="pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 w-40 outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Score range filter */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            {([
              { k: 'all', label: 'All Scores' },
              { k: 'top', label: 'Top 25%' },
              { k: 'mid', label: 'Middle 50%' },
              { k: 'low', label: 'Bottom 25%' },
            ] as const).map(({ k, label }) => (
              <button
                key={k} onClick={() => setScoreFilter(k)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  scoreFilter === k ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Result count */}
          <span className="text-[10px] text-slate-600 font-bold">{students.length}/{totalCount}</span>
        </div>

        {/* ── Column Headers ── */}
        <div className="grid grid-cols-[28px_1fr_90px_90px_80px_130px] gap-2 px-3 mb-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
          <span>#</span>
          <span>Name</span>
          <span className="flex justify-center"><ColHeader k="score"    label="Score" /></span>
          <span className="flex justify-center"><ColHeader k="attempted" label="Attempted" /></span>
          <span className="flex justify-center"><ColHeader k="passed"   label="Passed" /></span>
          <span><ColHeader k="weakTopic" label="Weak Topic" /></span>
        </div>

        {/* ── Rows ── */}
        <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
          {students.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-8">No students match the current filters.</p>
          ) : students.map((s: any, i: number) => {
            const isActive = activeNames.has(s.name);
            const passed   = getPassed(s);
            return (
              <div
                key={i}
                onClick={() => setSelectedStudent(s)}
                className="grid grid-cols-[28px_1fr_90px_90px_80px_130px] gap-2 items-center p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="text-[10px] font-black text-slate-600">{i + 1}</div>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                  <span className="text-xs font-medium text-slate-200 truncate">{s.name}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs font-black" style={{ color: scoreColor(s.averageScore) }}>
                    {s.averageScore.toFixed(1)}%
                  </span>
                </div>
                <div className="text-center text-xs text-slate-400">{s.questionsAttempted}</div>
                <div className="text-center text-xs text-slate-400">{passed}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {s.weakTopic !== 'N/A' ? s.weakTopic : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active vs Passive split */}
      {engagementData && (
        <div className="grid grid-cols-2 gap-4">
          <div className={card + ' border-emerald-500/20'}>
            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">🟢 Most Active (7 days)</h4>
            {(engagementData.top_active_students ?? []).map((s: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-800 last:border-0">
                <span className="text-xs text-slate-300">{s.first_name} {s.last_name}</span>
                <span className="text-xs font-bold text-emerald-400">{s.submissions_7d} submissions</span>
              </div>
            ))}
          </div>
          <div className={card + ' border-rose-500/20'}>
            <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3">🔴 Least Active (14 days)</h4>
            {(engagementData.most_passive_students ?? []).map((s: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-800 last:border-0">
                <span className="text-xs text-slate-300">{s.first_name} {s.last_name}</span>
                <span className="text-xs font-bold text-rose-400">{s.total_submissions_ever} total</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── HINT ANALYTICS ───────────────────────────────────────────────────────────
export const HintAnalyticsView = ({ hintData }: any) => {
  const byLevel = hintData?.by_level ?? [];
  const top = hintData?.top_struggling_problems ?? [];
  const total = byLevel.reduce((s: number, r: any) => s + (r.requests ?? 0), 0);
  return (
    <div className="space-y-4">
      <PageBanner
        icon="💡"
        title="Hint Analytics — Where Students Need Help"
        description="Shows which problems students ask for help on and at what hint depth. Level 1 is a gentle nudge, Level 2 is more specific guidance, Level 3 is near-solution. High Level 2-3 demand on a problem signals that the underlying concept was not well understood — revisit your in-class explanation for that topic."
      />
      <div className="grid grid-cols-3 gap-4">
        {byLevel.map((r: any) => (
          <div key={r.hint_level} className={card}>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Level {r.hint_level} Hints</div>
            <div className="text-2xl font-black text-amber-400">{r.requests}</div>
            <div className="text-[10px] text-slate-500">{total > 0 ? Math.round((r.requests / total) * 100) : 0}% of all hints · {r.unique_students} students</div>
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Lightbulb size={14} className="text-amber-400" /> Problems Requiring Most Hints</h3>
        {top.length === 0 ? <p className="text-slate-600 text-sm">No hint data yet.</p> : (
          <div className="space-y-2">
            {top.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-[10px] font-black text-amber-400 shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{p.problem_title}</div>
                  <div className="text-[10px] text-slate-500">{p.topic_name} · avg level {(p.avg_hint_level ?? 0).toFixed(1)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-amber-400">{p.total_hints} hints</div>
                  <div className="text-[9px] text-slate-500">{p.students_needing_hints} students</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── KNOWLEDGE GAPS ───────────────────────────────────────────────────────────
export const KnowledgeGapsView = ({ gapsData, onAnalyzeGaps, isGenerating, aiReport }: any) => (
  <div className="space-y-4">
    <PageBanner
      icon="🔍"
      title="Knowledge Gaps — Where Learning Broke Down"
      description="Problems with a failure rate above 40% — these are the points where classroom communication broke down. This is not just a student problem; it's a signal that the teaching approach for those concepts needs revisiting. Click .AI Analysis. to get pedagogical recommendations tailored to this class."
      legendItems={[
        { dot: '#ef4444', label: '>60% failure rate — Critical' },
        { dot: '#f59e0b', label: '40–60% failure rate — Watch Closely' },
      ]}
    />
    <div className={card + ' border-rose-500/20'}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14} /> High Failure Rate Problems</h3>
        <button onClick={onAnalyzeGaps} disabled={isGenerating} className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50">
          {isGenerating ? 'Analyzing...' : '🤖 AI Analysis'}
        </button>
      </div>
      {aiReport && <div className="mb-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl"><p className="text-slate-300 text-sm leading-relaxed italic">"{aiReport}"</p></div>}
      {gapsData.length === 0 ? <p className="text-slate-600 text-sm">No knowledge gaps detected (min 3 attempts threshold).</p> : (
        <div className="space-y-2">
          {gapsData.map((g: any, i: number) => (
            <div key={i} className="p-4 rounded-xl bg-slate-950/50 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-xs font-semibold text-slate-200">{g.problem_title}</div>
                  <div className="text-[10px] text-slate-500">{g.topic_name} · {g.difficulty}</div>
                </div>
                <span className="shrink-0 px-2 py-1 bg-rose-500/15 text-rose-400 text-[10px] font-black rounded-lg">{Math.round(g.failure_rate_pct)}% fail</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${g.failure_rate_pct}%` }} /></div>
              <div className="flex gap-4 mt-1.5 text-[9px] text-slate-600">
                <span>{g.unique_students} students attempted</span>
                <span>{g.total_attempts} total attempts</span>
                <span>{g.avg_hints_per_student} avg hints</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
