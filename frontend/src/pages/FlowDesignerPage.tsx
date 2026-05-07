import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch, Shield, Clock, BarChart, CheckCircle, ArrowRight,
  AlertCircle, Check, ExternalLink, Rocket, ChevronRight,
  Lightbulb, BookOpen, RefreshCw,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole, Course } from '../types';
import { cn } from '../lib/utils';
import { saveDraftFlow, updateFlow, deployFlow } from '../api/flows';
import type { FlowJson, FlowConfig } from '../api/flows';
import { useInstructorClasses } from '../hooks/useInstructorClasses';

interface FlowDesignerPageProps {
  sections: Section[];
  classId?: string;
  courses?: Course[];
  activeCourseId?: string;
  onCourseChange?: (id: string) => void;
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
  onDeploySuccess?: (classId: string) => void;
  pendingEnrollmentsCount?: number;
  activeAnalyticsView?: string;
  onAnalyticsViewChange?: (view: string) => void;
}

type NodeType =
  | 'LESSON' | 'CONCEPTUAL' | 'CODING' | 'MULTIPLE_CHOICE'
  | 'HINT' | 'EXPLANATION' | 'WORKED_EXAMPLE'
  | 'BRANCH' | 'MASTERY_GATE' | 'SCORE_CHECK' | 'SPACED_REVIEW'
  | 'MARK_DONE' | 'NEXT_SECTION';

interface FlowNode { id: string; type: NodeType; label: string; config?: any; }
interface Connection { from: string; to: string; label?: string; color?: string; }

const NODE_COLOR: Record<string, string> = {
  LESSON: '#00b4d8', CONCEPTUAL: '#3b82f6', CODING: '#3b82f6',
  MULTIPLE_CHOICE: '#3b82f6', HINT: '#f59e0b', EXPLANATION: '#f59e0b',
  WORKED_EXAMPLE: '#f59e0b', BRANCH: '#8b5cf6', MASTERY_GATE: '#8b5cf6',
  SCORE_CHECK: '#8b5cf6', SPACED_REVIEW: '#64748b',
  MARK_DONE: '#00e5a0', NEXT_SECTION: '#00e5a0',
};

const PATTERN_ID: Record<string, string> = {
  'Socratic Retry': 'socratic_retry',
  'Mastery Gate': 'mastery_gate',
  'Spaced Retrieval': 'spaced_retrieval',
  'Adaptive Branch': 'adaptive_branch',
};

interface Pattern {
  id: string;
  name: string;
  icon: React.ReactNode;
  tagline: string;
  description: string;
  reference: string;
  referenceUrl: string;
  referenceShort: string;
  nodes: FlowNode[];
  connections: Connection[];
  defaultConfig: Record<string, any>;
}

const PATTERNS: Pattern[] = [
  {
    id: 'socratic_retry',
    name: 'Socratic Retry',
    icon: <Lightbulb size={20} />,
    tagline: 'Guided hints before revealing the answer',
    description: 'Students attempt a question. If wrong, they receive a hint and retry. After N hints the answer is revealed with a full explanation. Encourages productive struggle.',
    reference: 'Macina et al. (2023), "MathDial: A Dialogue Tutoring Dataset." EMNLP.',
    referenceUrl: 'https://arxiv.org/abs/2305.14536',
    referenceShort: 'Macina et al. (2023) · EMNLP',
    nodes: [
      { id: '1', type: 'LESSON', label: 'Introduction' },
      { id: '2', type: 'CONCEPTUAL', label: 'Concept Check' },
      { id: '3', type: 'BRANCH', label: 'Evaluate', config: { threshold_score: 80 } },
      { id: '4', type: 'HINT', label: 'Hint', config: { max_hints: 2 } },
      { id: '5', type: 'CONCEPTUAL', label: 'Retry' },
      { id: '6', type: 'EXPLANATION', label: 'Explanation' },
      { id: '7', type: 'MARK_DONE', label: 'Done' },
    ],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '6', label: 'CORRECT', color: '#00e5a0' },
      { from: '3', to: '4', label: 'WRONG', color: '#f43f5e' },
      { from: '4', to: '5' },
      { from: '5', to: '3' },
      { from: '6', to: '7' },
    ],
    defaultConfig: { threshold_score: 80, max_hints: 2 },
  },
  {
    id: 'mastery_gate',
    name: 'Mastery Gate',
    icon: <Shield size={20} />,
    tagline: 'Must answer correctly N times before advancing',
    description: 'Students must demonstrate consistent mastery by answering correctly several times in a row. Failures route them to a worked example before they retry.',
    reference: 'İlic et al. (2022), "A Practical Review of Mastery Learning." Am. J. Pharmaceutical Education.',
    referenceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35027359/',
    referenceShort: 'İlic et al. (2022) · PubMed',
    nodes: [
      { id: '1', type: 'LESSON', label: 'Core Concept' },
      { id: '2', type: 'CODING', label: 'Practice Task' },
      { id: '3', type: 'MASTERY_GATE', label: 'Mastery Check', config: { consecutive_correct: 3 } },
      { id: '4', type: 'WORKED_EXAMPLE', label: 'Remediation' },
      { id: '5', type: 'NEXT_SECTION', label: 'Next Topic' },
    ],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '5', label: 'PASSED', color: '#00e5a0' },
      { from: '3', to: '4', label: 'FAILED', color: '#f43f5e' },
      { from: '4', to: '2' },
    ],
    defaultConfig: { consecutive_correct: 3 },
  },
  {
    id: 'spaced_retrieval',
    name: 'Spaced Retrieval',
    icon: <Clock size={20} />,
    tagline: 'Review prompts at scientifically spaced intervals',
    description: 'After initial learning, the platform automatically schedules review sessions at expanding intervals (e.g. day 1, 3, 7). Based on the spacing effect in cognitive science.',
    reference: 'Carpenter et al. (2022), "Spacing effects in learning and memory." Nature Reviews Psychology.',
    referenceUrl: 'https://www.nature.com/articles/s44159-022-00089-1',
    referenceShort: 'Carpenter et al. (2022) · Nature',
    nodes: [
      { id: '1', type: 'LESSON', label: 'Initial Learning' },
      { id: '2', type: 'SPACED_REVIEW', label: 'Review Cycle', config: { review_days: [1, 3, 7] } },
      { id: '3', type: 'CONCEPTUAL', label: 'Retrieval Quiz' },
      { id: '4', type: 'MARK_DONE', label: 'Mastered' },
    ],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '4' },
    ],
    defaultConfig: { review_days: [1, 3, 7] },
  },
  {
    id: 'adaptive_branch',
    name: 'Adaptive Branch',
    icon: <GitBranch size={20} />,
    tagline: 'Routes students to different paths based on their score',
    description: 'A diagnostic question routes students to either an advanced or introductory path based on their score. Personalises the experience without manual grouping.',
    reference: 'Alharthi et al. (2024), "Personalized Adaptive Learning in Higher Education." PMC.',
    referenceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11544060/',
    referenceShort: 'Alharthi et al. (2024) · PMC',
    nodes: [
      { id: '1', type: 'MULTIPLE_CHOICE', label: 'Diagnostic' },
      { id: '2', type: 'SCORE_CHECK', label: 'Check Level', config: { threshold_score: 70 } },
      { id: '3', type: 'LESSON', label: 'Advanced Path' },
      { id: '4', type: 'LESSON', label: 'Intro Path' },
      { id: '5', type: 'MARK_DONE', label: 'Complete' },
    ],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3', label: 'HIGH', color: '#8b5cf6' },
      { from: '2', to: '4', label: 'LOW', color: '#06b6d4' },
      { from: '3', to: '5' },
      { from: '4', to: '5' },
    ],
    defaultConfig: { threshold_score: 70 },
  },
];

// ── Flow Diagram (static SVG) ─────────────────────────────────────────────────
const FlowDiagram: React.FC<{ pattern: Pattern; config: Record<string, any> }> = ({ pattern, config }) => {
  const NODE_W = 110; const NODE_H = 44; const GAP_X = 60; const GAP_Y = 70;
  // Compute positions: left-to-right layout based on connection depth
  const depth: Record<string, number> = {};
  const row: Record<string, number> = {};
  pattern.nodes.forEach(n => { depth[n.id] = 0; row[n.id] = 0; });
  // BFS for depth
  const inEdges: Record<string, string[]> = {};
  pattern.nodes.forEach(n => { inEdges[n.id] = []; });
  pattern.connections.forEach(c => { inEdges[c.to]?.push(c.from); });
  const queue = pattern.nodes.filter(n => inEdges[n.id].length === 0).map(n => n.id);
  const visited = new Set(queue);
  queue.forEach(id => { depth[id] = 0; });
  let q = [...queue];
  while (q.length) {
    const id = q.shift()!;
    pattern.connections.filter(c => c.from === id).forEach(c => {
      if (!visited.has(c.to)) { visited.add(c.to); depth[c.to] = depth[id] + 1; q.push(c.to); }
    });
  }
  // Assign rows within same depth
  const byDepth: Record<number, string[]> = {};
  pattern.nodes.forEach(n => { const d = depth[n.id] ?? 0; (byDepth[d] = byDepth[d] || []).push(n.id); });
  Object.values(byDepth).forEach(ids => ids.forEach((id, i) => { row[id] = i; }));
  const maxDepth = Math.max(...pattern.nodes.map(n => depth[n.id] ?? 0));
  const maxRow = Math.max(...pattern.nodes.map(n => row[n.id] ?? 0));
  const W = (maxDepth + 1) * (NODE_W + GAP_X) + 40;
  const colHeight = (d: number) => (byDepth[d] || []).length;
  const H = Math.max(200, (maxRow + 1) * (NODE_H + GAP_Y) + 40);
  const px = (id: string) => (depth[id] ?? 0) * (NODE_W + GAP_X) + 20;
  const py = (id: string) => {
    const d = depth[id] ?? 0; const r = row[id] ?? 0; const total = colHeight(d);
    return (H / 2) - ((total - 1) * (NODE_H + GAP_Y)) / 2 + r * (NODE_H + GAP_Y);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: Math.max(180, H) }}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#475569" />
        </marker>
      </defs>
      {pattern.connections.map((conn, i) => {
        const fx = px(conn.from) + NODE_W; const fy = py(conn.from) + NODE_H / 2;
        const tx = px(conn.to); const ty = py(conn.to) + NODE_H / 2;
        const mx = (fx + tx) / 2;
        const stroke = conn.color || '#475569';
        return (
          <g key={i}>
            <path d={`M${fx},${fy} C${mx},${fy} ${mx},${ty} ${tx},${ty}`}
              stroke={stroke} strokeWidth="2" fill="none" markerEnd="url(#arrow)" opacity="0.7" />
            {conn.label && (
              <text x={mx} y={(fy + ty) / 2 - 6} textAnchor="middle"
                fontSize="9" fontWeight="700" fill={stroke} opacity="0.9">
                {conn.label}
              </text>
            )}
          </g>
        );
      })}
      {pattern.nodes.map(node => {
        const x = px(node.id); const y = py(node.id);
        const color = NODE_COLOR[node.type] || '#64748b';
        return (
          <g key={node.id}>
            <rect x={x} y={y} width={NODE_W} height={NODE_H} rx="8"
              fill={`${color}18`} stroke={color} strokeWidth="1.5" />
            <text x={x + NODE_W / 2} y={y + 14} textAnchor="middle"
              fontSize="8" fontWeight="800" fill={color} opacity="0.7">
              {node.type.replace(/_/g, ' ')}
            </text>
            <text x={x + NODE_W / 2} y={y + 30} textAnchor="middle"
              fontSize="11" fontWeight="600" fill="#e2e8f0">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Config Panel per pattern ──────────────────────────────────────────────────
const ConfigPanel: React.FC<{ pattern: Pattern; config: Record<string, any>; onChange: (k: string, v: any) => void }> = ({ pattern, config, onChange }) => {
  if (pattern.id === 'socratic_retry') return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">Pass threshold (%)</label>
        <p className="text-xs text-slate-500 mb-2">Score at or above this → correct path. Below → hint path.</p>
        <div className="flex items-center gap-3">
          <input type="range" min={50} max={100} step={5}
            value={config.threshold_score ?? 80}
            onChange={e => onChange('threshold_score', +e.target.value)}
            className="flex-1 accent-emerald-400" />
          <span className="text-lg font-black text-emerald-400 w-12 text-right">{config.threshold_score ?? 80}%</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1">Max hints before reveal</label>
        <p className="text-xs text-slate-500 mb-2">Student sees this many hints before the answer is shown.</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onChange('max_hints', n)}
              className={cn('w-10 h-10 rounded-xl font-black text-sm transition-all',
                (config.max_hints ?? 2) === n ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  if (pattern.id === 'mastery_gate') return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-1">Consecutive correct answers required</label>
      <p className="text-xs text-slate-500 mb-3">Student must answer correctly this many times in a row to advance.</p>
      <div className="flex gap-2">
        {[2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange('consecutive_correct', n)}
            className={cn('w-12 h-12 rounded-xl font-black text-base transition-all',
              (config.consecutive_correct ?? 3) === n ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
            {n}×
          </button>
        ))}
      </div>
    </div>
  );
  if (pattern.id === 'spaced_retrieval') return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-1">Review intervals (days)</label>
      <p className="text-xs text-slate-500 mb-3">Days after initial learning when review sessions are triggered.</p>
      <div className="flex gap-3 items-center">
        {(config.review_days ?? [1, 3, 7]).map((d: number, i: number) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-500">Day {i + 1}</span>
            <input type="number" min={1} value={d}
              onChange={e => { const days = [...(config.review_days ?? [1, 3, 7])]; days[i] = +e.target.value; onChange('review_days', days); }}
              className="w-16 h-12 bg-slate-800 border border-slate-700 rounded-xl text-center text-lg font-black text-cyan-400 outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        ))}
      </div>
    </div>
  );
  if (pattern.id === 'adaptive_branch') return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-1">Routing threshold (%)</label>
      <p className="text-xs text-slate-500 mb-2">Score ≥ threshold → Advanced path. Below → Introductory path.</p>
      <div className="flex items-center gap-3">
        <input type="range" min={30} max={90} step={5}
          value={config.threshold_score ?? 70}
          onChange={e => onChange('threshold_score', +e.target.value)}
          className="flex-1 accent-purple-400" />
        <span className="text-lg font-black text-purple-400 w-12 text-right">{config.threshold_score ?? 70}%</span>
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-2 text-xs text-purple-300"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> ≥ {config.threshold_score ?? 70}% → Advanced</div>
        <div className="flex items-center gap-2 text-xs text-cyan-300"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Below → Introductory</div>
      </div>
    </div>
  );
  return null;
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({
  sections, classId: classIdProp, onDashboardClick, onProblemsClick,
  onAnalyticsClick, onSectionSelect, onInstructorDashboardClick,
  onCourseBuilderClick, onFlowDesignerClick, onEnrollmentManagementClick,
  onLogout, onSwitchCourse, courseName, userRole, onDeploySuccess,
  pendingEnrollmentsCount = 0, activeAnalyticsView, onAnalyticsViewChange,
}) => {
  const { classes: instructorClasses, refetch: refetchClasses } = useInstructorClasses();
  const [activeClassId, setActiveClassId] = React.useState<string>(classIdProp || '');
  const activeClass = instructorClasses.find(c => c.class_id === activeClassId) ?? instructorClasses[0];
  React.useEffect(() => {
    if (instructorClasses.length > 0 && !activeClassId) {
      const preferred = instructorClasses.find(c => c.class_id === classIdProp);
      setActiveClassId((preferred ?? instructorClasses[0]).class_id);
    }
  }, [instructorClasses, activeClassId, classIdProp]);

  const [activePatternId, setActivePatternId] = useState<string>('socratic_retry');
  const [config, setConfig] = useState<Record<string, any>>(PATTERNS[0].defaultConfig);
  const [flowStatus, setFlowStatus] = useState<'DRAFT' | 'SAVED' | 'LIVE'>('DRAFT');
  const [savedFlowId, setSavedFlowId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const pattern = useMemo(() => PATTERNS.find(p => p.id === activePatternId) ?? PATTERNS[0], [activePatternId]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const selectPattern = (p: Pattern) => {
    setActivePatternId(p.id);
    setConfig(p.defaultConfig);
    setSavedFlowId(null);
    setFlowStatus('DRAFT');
  };

  const buildFlowJson = (): FlowJson => ({
    nodes: pattern.nodes.map(n => ({ id: n.id, type: n.type, x: 0, y: 0, label: n.label, config: n.config })),
    connections: pattern.connections.map(c => ({ from: c.from, to: c.to, label: c.label, color: c.color })),
  });

  const buildConfig = (): FlowConfig => config as FlowConfig;


  const handleDeploy = async () => {
    if (!activeClass) { showToast('No class selected', false); return; }
    setIsDeploying(true);
    try {
      let fid = savedFlowId;
      if (!fid) {
        const r = await saveDraftFlow({ class_id: activeClass.class_id, pattern: pattern.id, flow_json: buildFlowJson(), config: buildConfig() });
        fid = r.id; setSavedFlowId(fid);
      } else {
        await updateFlow(fid, { pattern: pattern.id, flow_json: buildFlowJson(), config: buildConfig() });
      }
      await deployFlow(fid!);
      setFlowStatus('LIVE'); refetchClasses();
      showToast(`🚀 "${pattern.name}" deployed to ${activeClass.class_code}!`);
      onDeploySuccess?.(activeClass.class_id);
    } catch (e: any) { showToast(e.message || 'Deploy failed', false); }
    setIsDeploying(false);
  };

  return (
    <div className="flex h-[calc(100vh-180px)] bg-[#0b1120] text-slate-200 overflow-hidden font-sans">
      <Sidebar
        sections={sections} activeSectionId="flow-designer"
        onSectionSelect={onSectionSelect} onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick} onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onCourseBuilderClick={onCourseBuilderClick}
        onFlowDesignerClick={onFlowDesignerClick}
        onEnrollmentManagementClick={onEnrollmentManagementClick}
        pendingEnrollmentsCount={pendingEnrollmentsCount}
        onSwitchCourse={onSwitchCourse} onLogout={onLogout}
        userRole={userRole} courseName={courseName}
        activeAnalyticsView={activeAnalyticsView}
        onAnalyticsViewChange={onAnalyticsViewChange}
      />

      <div className="flex-1 flex flex-col ml-72 overflow-hidden">
        {/* ── Header ── */}
        <header className="shrink-0 border-b border-slate-800 bg-[#0b1120] px-8 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Flow Designer</h1>
              <p className="text-sm text-slate-400 mt-1 max-w-lg">
                Choose a research-backed learning pattern, tune its parameters, then deploy to your students with one click.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {activeClass && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700">
                  <span className={cn("w-2 h-2 rounded-full", flowStatus === 'LIVE' ? 'bg-emerald-400' : 'bg-slate-500')} />
                  <span className="text-sm font-bold text-slate-300">{activeClass.class_code}</span>
                  <span className={cn("text-xs font-black px-2 py-0.5 rounded-md",
                    flowStatus === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500')}>
                    {flowStatus}
                  </span>
                </div>
              )}
              <button onClick={handleDeploy} disabled={isDeploying}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-sm font-black transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                {isDeploying ? <><RefreshCw size={14} className="animate-spin" /> Deploying…</> : <><Rocket size={14} /> Deploy Flow</>}
              </button>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — Pattern selector */}
          <aside className="w-72 shrink-0 border-r border-slate-800 bg-[#0d1526] flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-slate-800">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Learning Patterns</p>
            </div>
            <div className="p-4 space-y-2 flex-1">
              {PATTERNS.map(p => (
                <button key={p.id} onClick={() => selectPattern(p)}
                  className={cn(
                    'w-full text-left p-4 rounded-2xl border transition-all group',
                    activePatternId === p.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40'
                  )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                      activePatternId === p.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-slate-300')}>
                      {p.icon}
                    </div>
                    {activePatternId === p.id && <Check size={16} className="text-emerald-400" />}
                  </div>
                  <div className="text-sm font-bold text-white mb-0.5">{p.name}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{p.tagline}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* CENTER — Flow diagram + description */}
          <main className="flex-1 flex flex-col overflow-y-auto bg-[#0b1120]">
            {/* Diagram */}
            <div className="p-8 pb-0">
              <div className="rounded-2xl border border-slate-800 bg-[#0d1526] p-6">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Flow Diagram — {pattern.name}</p>
                <FlowDiagram pattern={pattern} config={config} />
              </div>
            </div>

            {/* Description + reference */}
            <div className="p-8 pt-5">
              <div className="rounded-2xl border border-slate-800 bg-[#0d1526] p-6 space-y-4">
                <div>
                  <h2 className="text-base font-black text-white mb-1">{pattern.name}</h2>
                  <p className="text-sm text-slate-400 leading-relaxed">{pattern.description}</p>
                </div>
                <a href={pattern.referenceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-all">
                  <ExternalLink size={12} /> {pattern.referenceShort}
                </a>
              </div>
            </div>
          </main>

          {/* RIGHT — Configuration */}
          <aside className="w-80 shrink-0 border-l border-slate-800 bg-[#0d1526] flex flex-col">
            {/* Current live flow card */}
            <div className="p-5 border-b border-slate-800">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Currently Active Flow</p>
              {activeClass?.has_live_flow && activeClass.active_pattern ? (() => {
                const livePattern = PATTERNS.find(p => p.id === activeClass.active_pattern);
                return (
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      {livePattern?.icon ?? <Check size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-400">{livePattern?.name ?? activeClass.active_pattern}</p>
                      <p className="text-xs text-slate-500">{activeClass.total_students} students · Live</p>
                    </div>
                    <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                );
              })() : (
                <div className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400">No flow active</p>
                    <p className="text-xs text-slate-600">Students are using the default path</p>
                  </div>
                </div>
              )}
            </div>
            {/* Parameters */}
            <div className="p-5 border-b border-slate-800">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Configure Parameters</p>
              <p className="text-xs text-slate-600 mt-1">Tune the selected pattern, then deploy.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ConfigPanel pattern={pattern} config={config} onChange={(k, v) => setConfig(prev => ({ ...prev, [k]: v }))} />
            </div>
            {/* Stats footer */}
            <div className="border-t border-slate-800 p-5">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Flow Summary</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Steps', value: pattern.nodes.length },
                  { label: 'Decisions', value: pattern.nodes.filter(n => ['BRANCH','MASTERY_GATE','SCORE_CHECK'].includes(n.type)).length },
                  { label: 'Edges', value: pattern.connections.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800">
                    <div className="text-xl font-black text-white">{value}</div>
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className={cn('fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-3',
              toast.ok ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white')}>
            {toast.ok ? <Check size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .accent-emerald-400 { accent-color: #34d399; }
        .accent-purple-400  { accent-color: #a78bfa; }
      `}</style>
    </div>
  );
};

export default FlowDesignerPage;
