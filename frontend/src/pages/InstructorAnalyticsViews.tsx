import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Cell } from 'recharts';
import { BookOpen, Target, Users, Lightbulb, AlertTriangle, TrendingUp, Activity, Search, ChevronUp, ChevronDown } from 'lucide-react';

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

// ── STUDENT PERFORMANCE ───────────────────────────────────────────────────────
export const StudentPerformanceView = ({ data, engagementData }: any) => {
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const students = [...(data?.students ?? [])].filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase())).sort((a: any, b: any) => sortDir === 'desc' ? b.averageScore - a.averageScore : a.averageScore - b.averageScore);
  const activeNames = new Set((engagementData?.top_active_students ?? []).map((s: any) => `${s.first_name} ${s.last_name}`));
  return (
    <div className="space-y-4">
      <PageBanner
        icon="👥"
        title="Student Performance — Rankings & Engagement"
        description="All students ranked by mastery score. A green dot means the student was active in the last 7 days; grey means no recent activity. The .Weak Topic. column shows where each student needs the most support — use it to identify who needs 1-on-1 attention."
        legendItems={[
          { dot: '#10b981', label: 'Active — practiced in last 7 days' },
          { dot: '#334155', label: 'Passive — no recent activity' },
        ]}
      />
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14} /> Student Rankings</h3>
          <div className="flex items-center gap-2">
            <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 w-36 outline-none" /></div>
            <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">{sortDir === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
          </div>
        </div>
        <div className="grid grid-cols-[28px_1fr_80px_80px_80px_120px] gap-2 px-3 mb-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
          <span>#</span><span>Name</span><span className="text-center">Score</span><span className="text-center">Attempted</span><span className="text-center">Passed</span><span>Weak Topic</span>
        </div>
        <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
          {students.map((s: any, i: number) => {
            const isActive = activeNames.has(s.name);
            return (
              <div key={i} className="grid grid-cols-[28px_1fr_80px_80px_80px_120px] gap-2 items-center p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/40 transition-colors">
                <div className="text-[10px] font-black text-slate-600">{i + 1}</div>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                  <span className="text-xs font-medium text-slate-200 truncate">{s.name}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs font-black" style={{ color: scoreColor(s.averageScore) }}>{s.averageScore.toFixed(1)}%</span>
                </div>
                <div className="text-center text-xs text-slate-400">{s.questionsAttempted}</div>
                <div className="text-center text-xs text-slate-400">{s.questionsAttempted > 0 ? Math.round(s.questionsAttempted * (s.averageScore / 100)) : 0}</div>
                <div className="text-[10px] text-slate-500 truncate">{s.weakTopic !== 'N/A' ? s.weakTopic : '—'}</div>
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
