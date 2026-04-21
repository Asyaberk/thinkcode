import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  GitBranch,
  Settings,
  Layers,
  Clock,
  BookOpen,
  FileText,
  Play,
  MessageCircle,
  List,
  Code,
  Lightbulb,
  Shield,
  BarChart,
  CheckCircle,
  ArrowRight,
  Eye,
  AlertCircle,
  Check,
  Rocket,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole, Course } from '../types';
import { cn } from '../lib/utils';
import { saveDraftFlow, updateFlow, deployFlow } from '../api/flows';
import type { FlowJson, FlowConfig } from '../api/flows';
import { useInstructorClasses } from '../hooks/useInstructorClasses';


interface FlowDesignerPageProps {
  sections: Section[];
  classId?: string;           // DB'deki gerçek class UUID — API çağrıları için
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
  onLogout?: () => void;
  userRole?: UserRole;
}

type NodeType = 
  | 'LESSON' | 'SHOW_PDF' | 'SHOW_VIDEO'
  | 'CONCEPTUAL' | 'MULTIPLE_CHOICE' | 'CODING'
  | 'HINT' | 'EXPLANATION' | 'WORKED_EXAMPLE'
  | 'BRANCH' | 'MASTERY_GATE' | 'SCORE_CHECK'
  | 'SPACED_REVIEW'
  | 'MARK_DONE' | 'NEXT_SECTION';

interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  config?: any;
}

interface Connection {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

const NODE_CATEGORIES: Record<string, { label: string; nodes: { type: NodeType; label: string; icon: any; color: string }[] }> = {
  CONTENT: {
    label: 'CONTENT',
    nodes: [
      { type: 'LESSON', label: 'Lesson', icon: BookOpen, color: '#00b4d8' },
      { type: 'SHOW_PDF', label: 'Show PDF', icon: FileText, color: '#00b4d8' },
      { type: 'SHOW_VIDEO', label: 'Show Video', icon: Play, color: '#00b4d8' },
    ]
  },
  QUESTIONS: {
    label: 'QUESTIONS',
    nodes: [
      { type: 'CONCEPTUAL', label: 'Conceptual', icon: MessageCircle, color: '#3b82f6' },
      { type: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: List, color: '#3b82f6' },
      { type: 'CODING', label: 'Coding', icon: Code, color: '#3b82f6' },
    ]
  },
  SUPPORT: {
    label: 'SUPPORT',
    nodes: [
      { type: 'HINT', label: 'Hint', icon: Lightbulb, color: '#f59e0b' },
      { type: 'EXPLANATION', label: 'Explanation', icon: BookOpen, color: '#f59e0b' },
      { type: 'WORKED_EXAMPLE', label: 'Worked Example', icon: Layers, color: '#f59e0b' },
    ]
  },
  LOGIC: {
    label: 'LOGIC',
    nodes: [
      { type: 'BRANCH', label: 'Branch', icon: GitBranch, color: '#8b5cf6' },
      { type: 'MASTERY_GATE', label: 'Mastery Gate', icon: Shield, color: '#8b5cf6' },
      { type: 'SCORE_CHECK', label: 'Score Check', icon: BarChart, color: '#8b5cf6' },
    ]
  },
  TIMING: {
    label: 'TIMING',
    nodes: [
      { type: 'SPACED_REVIEW', label: 'Spaced Review', icon: Clock, color: '#64748b' },
    ]
  },
  COMPLETE: {
    label: 'COMPLETE',
    nodes: [
      { type: 'MARK_DONE', label: 'Mark Done', icon: CheckCircle, color: '#00e5a0' },
      { type: 'NEXT_SECTION', label: 'Next Section', icon: ArrowRight, color: '#00e5a0' },
    ]
  }
};

const TEMPLATES = {
  'Socratic Retry': {
    nodes: [
      { id: '1', type: 'LESSON', x: 60, y: 200, label: 'Introduction', config: {} },
      { id: '2', type: 'CONCEPTUAL', x: 270, y: 200, label: 'Concept Check', config: {} },
      { id: '3', type: 'BRANCH', x: 480, y: 200, label: 'Evaluate Answer', config: { threshold_score: 80 } },
      { id: '4', type: 'HINT', x: 480, y: 340, label: 'Conceptual Hint', config: { max_hints: 2 } },
      { id: '5', type: 'CONCEPTUAL', x: 270, y: 340, label: 'Retry Question', config: {} },
      { id: '6', type: 'EXPLANATION', x: 690, y: 200, label: 'Full Explanation', config: {} },
      { id: '7', type: 'MARK_DONE', x: 900, y: 200, label: 'Module Complete', config: {} },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '6', label: 'CORRECT', color: '#00e5a0' },
      { from: '3', to: '4', label: 'WRONG', color: '#f43f5e' },
      { from: '4', to: '5' },
      { from: '5', to: '3' },
      { from: '6', to: '7' },
    ] as Connection[],
    reference: 'Macina et al. (2023), "MathDial: A Dialogue Tutoring Dataset with Rich Pedagogical Properties Grounded in Math Reasoning Problems." Findings of EMNLP 2023.',
    referenceUrl: 'https://arxiv.org/abs/2305.14536',
    referenceShort: 'Macina et al. (2023) · EMNLP · arXiv:2305.14536',
  },
  'Mastery Gate': {
    nodes: [
      { id: '1', type: 'LESSON', x: 60, y: 200, label: 'Core Concept', config: {} },
      { id: '2', type: 'CODING', x: 270, y: 200, label: 'Practice Task', config: {} },
      { id: '3', type: 'MASTERY_GATE', x: 480, y: 200, label: 'Mastery Check', config: { consecutive_correct: 3 } },
      { id: '4', type: 'WORKED_EXAMPLE', x: 480, y: 340, label: 'Remediation', config: {} },
      { id: '5', type: 'NEXT_SECTION', x: 690, y: 200, label: 'Next Topic', config: {} },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '5', label: 'PASSED', color: '#00e5a0' },
      { from: '3', to: '4', label: 'FAILED', color: '#f43f5e' },
      { from: '4', to: '2' },
    ] as Connection[],
    reference: 'İlic et al. (2022), "A Practical Review of Mastery Learning." American Journal of Pharmaceutical Education.',
    referenceUrl: 'https://pubmed.ncbi.nlm.nih.gov/35027359/',
    referenceShort: 'İlic et al. (2022) · PubMed',
  },
  'Spaced Retrieval': {
    nodes: [
      { id: '1', type: 'LESSON', x: 60, y: 200, label: 'Initial Learning', config: {} },
      { id: '2', type: 'SPACED_REVIEW', x: 270, y: 200, label: 'Review Cycle', config: { review_days: [1, 3, 7] } },
      { id: '3', type: 'CONCEPTUAL', x: 480, y: 200, label: 'Retrieval Quiz', config: {} },
      { id: '4', type: 'MARK_DONE', x: 690, y: 200, label: 'Mastered', config: {} },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '4' },
    ] as Connection[],
    reference: 'Carpenter et al. (2022), "Spacing effects in learning and memory: practical recommendations." Nature Reviews Psychology.',
    referenceUrl: 'https://www.nature.com/articles/s44159-022-00089-1',
    referenceShort: 'Carpenter et al. (2022) · Nature',
  },
  'Adaptive Branch': {
    nodes: [
      { id: '1', type: 'MULTIPLE_CHOICE', x: 60, y: 200, label: 'Diagnostic', config: {} },
      { id: '2', type: 'SCORE_CHECK', x: 270, y: 200, label: 'Check Level', config: { threshold_score: 70 } },
      { id: '3', type: 'LESSON', x: 480, y: 100, label: 'Advanced Path', config: {} },
      { id: '4', type: 'LESSON', x: 480, y: 300, label: 'Intro Path', config: {} },
      { id: '5', type: 'MARK_DONE', x: 690, y: 200, label: 'Complete', config: {} },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3', label: 'HIGH', color: '#8b5cf6' },
      { from: '2', to: '4', label: 'LOW', color: '#06b6d4' },
      { from: '3', to: '5' },
      { from: '4', to: '5' },
    ] as Connection[],
    reference: 'Alharthi et al. (2024), "Personalized Adaptive Learning in Higher Education: A Scoping Review." PMC Open Access.',
    referenceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11544060/',
    referenceShort: 'Alharthi et al. (2024) · PMC',
  }
};

const DEFAULT_COURSES: Course[] = [
  { id: 'cs101', name: 'CMPE211 — Algorithms & Data Structures', role: 'instructor' },
  { id: 'cs202', name: 'CS204 — Systems Programming', role: 'instructor' },
];

export const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({
  sections,
  classId: classIdProp,
  courses: coursesProp,
  activeCourseId: activeCourseIdProp,
  onCourseChange,
  onDashboardClick,
  onProblemsClick,
  onAnalyticsClick,
  onSectionSelect,
  onInstructorDashboardClick,
  onCourseBuilderClick,
  onFlowDesignerClick,
  onLogout,
  userRole
}) => {
  // — Gerçek sınıf listesi API'den —
  const { classes: instructorClasses, refetch: refetchClasses } = useInstructorClasses();

  // Seçilen sınıf: ilk sınıf otomatik seçilir
  const [activeClassId, setActiveClassId] = React.useState<string>('');
  const activeClass = instructorClasses.find(c => c.class_id === activeClassId) ?? instructorClasses[0];

  // Sınıf listesi yüklenince ilk sınıfı seç
  React.useEffect(() => {
    if (instructorClasses.length > 0 && !activeClassId) {
      setActiveClassId(instructorClasses[0].class_id);
    }
  }, [instructorClasses, activeClassId]);

  // Sınıf değişince flow ID'yi sıfırla — her sınıfın flow'u bağımsız
  const handleClassChange = (classId: string) => {
    setActiveClassId(classId);
    setSavedFlowId(null);
    setFlowStatus('DRAFT');
  };
  const [nodes, setNodes] = useState<Node[]>(TEMPLATES['Socratic Retry'].nodes);
  const [connections, setConnections] = useState<Connection[]>(TEMPLATES['Socratic Retry'].connections);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowStatus, setFlowStatus] = useState<'DRAFT' | 'SAVED' | 'LIVE'>('DRAFT');
  const [showDeployToast, setShowDeployToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [savedFlowId, setSavedFlowId] = useState<string | null>(null);
  const [activePattern, setActivePattern] = useState<string>('Socratic Retry');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);



  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const stats = useMemo(() => {
    const decisionPoints = nodes.filter(n => ['BRANCH', 'MASTERY_GATE', 'SCORE_CHECK'].includes(n.type)).length;
    return {
      nodes: nodes.length,
      decisions: decisionPoints,
      connections: connections.length
    };
  }, [nodes, connections]);

  const handleAddNode = (type: NodeType, label: string) => {
    const newNode: Node = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 400 + (Math.random() * 40 - 20),
      y: 300 + (Math.random() * 40 - 20),
      label,
      config: {}
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const applyTemplate = (name: string) => {
    const template = TEMPLATES[name as keyof typeof TEMPLATES];
    if (template) {
      setNodes(template.nodes.map(n => ({ ...n, config: { ...n.config } })));
      setConnections(template.connections);
      setSelectedNodeId(null);
      setActivePattern(name);
      setSavedFlowId(null);
      setFlowStatus('DRAFT');
    }
  };


  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowDeployToast(true);
    setTimeout(() => setShowDeployToast(false), 3500);
  };

  /** Node config'lerinden gerçek parametreleri okur ve backend'e gönderir */
  const buildConfig = (): FlowConfig => {
    const masteryNode = nodes.find(n => n.type === 'MASTERY_GATE');
    const branchNode  = nodes.find(n => n.type === 'BRANCH' || n.type === 'SCORE_CHECK');
    const spacedNode  = nodes.find(n => n.type === 'SPACED_REVIEW');
    const hintNode    = nodes.find(n => n.type === 'HINT');
    return {
      ...(masteryNode ? { consecutive_correct: masteryNode.config?.consecutive_correct ?? 3 } : {}),
      ...(branchNode  ? { threshold_score: branchNode.config?.threshold_score ?? 70 }        : {}),
      ...(spacedNode  ? { review_days: spacedNode.config?.review_days ?? [1, 3, 7] }          : {}),
      ...(hintNode    ? { max_hints: hintNode.config?.max_hints ?? 2 }                         : {}),
    };
  };

  const buildFlowJson = (): FlowJson => ({
    nodes: nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y, label: n.label, config: n.config })),
    connections: connections.map(c => ({ from: c.from, to: c.to, label: c.label, color: c.color })),
  });

  const handleSaveDraft = async () => {
    const targetClassId = activeClass?.class_id;
    if (!targetClassId) {
      showToast('⚠️ Sınıf seçili değil. Lütfen önce bir sınıf seçin.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        class_id: targetClassId,
        pattern: activePattern,
        flow_json: buildFlowJson(),
        config: buildConfig(),
      };

      let result;
      if (savedFlowId) {
        result = await updateFlow(savedFlowId, { pattern: payload.pattern, flow_json: payload.flow_json, config: payload.config });
      } else {
        result = await saveDraftFlow(payload);
        setSavedFlowId(result.id);
      }
      setFlowStatus('SAVED');
      showToast(`✓ Flow "${activeClass?.class_code}" için kaydedildi.`);
    } catch (err: any) {
      showToast(`Kaydetme hatası: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeploy = async () => {
    const targetClassId = activeClass?.class_id;
    if (!targetClassId) {
      showToast('⚠️ Sınıf seçili değil.', 'error');
      return;
    }
    setIsDeploying(true);
    try {
      let flowId = savedFlowId;
      if (!flowId) {
        const saved = await saveDraftFlow({
          class_id: targetClassId,
          pattern: activePattern,
          flow_json: buildFlowJson(),
          config: buildConfig(),
        });
        flowId = saved.id;
        setSavedFlowId(flowId);
      } else {
        await updateFlow(flowId, { flow_json: buildFlowJson(), config: buildConfig() });
      }

      await deployFlow(flowId);
      setFlowStatus('LIVE');
      refetchClasses();  // Sınıf listesindeki has_live_flow güncelle
      showToast(`🚀 "${activePattern}" patternı ${activeClass?.class_code} sınıfına deploy edildi!`);
    } catch (err: any) {
      showToast(`Deploy hatası: ${err.message}`, 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  const updateNodeLabel = (id: string, label: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, label } : n));
  };

  const updateNodeConfig = (id: string, key: string, value: any) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, config: { ...n.config, [key]: value } } : n));
  };

  return (
    <div className="flex h-screen bg-[#0f1623] text-slate-200 overflow-hidden font-sans">
      <Sidebar 
        sections={sections}
        activeSectionId="flow-designer"
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onAnalyticsClick={onAnalyticsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onCourseBuilderClick={onCourseBuilderClick}
        onFlowDesignerClick={onFlowDesignerClick}
        onLogout={onLogout}
        userRole={userRole}
      />

      <div className="flex-1 flex flex-col ml-72 overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-slate-800 bg-[#0f1623] px-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Learning Flow Designer</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Build the student experience, node by node</p>
          </div>

          {/* Gerçek Sınıf Seçici */}
          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-full border border-slate-800">
            {instructorClasses.length === 0 ? (
              <span className="px-4 py-1.5 text-[10px] text-slate-500">Sınıf yükleniyor...</span>
            ) : (
              instructorClasses.map(cls => (
                <button
                  key={cls.class_id}
                  onClick={() => handleClassChange(cls.class_id)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5",
                    activeClassId === cls.class_id
                      ? "bg-[#00e5a0] text-slate-950 shadow-lg shadow-emerald-500/20"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {cls.class_code}
                  {cls.has_live_flow && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      activeClassId === cls.class_id ? "bg-slate-950" : "bg-[#00e5a0]"
                    )} />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-700 hover:border-slate-500 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <span className="animate-pulse">Kaydediliyor...</span> : 'Save Draft'}
            </button>
            <button 
              onClick={handleDeploy}
              disabled={isDeploying}
              className="px-4 py-2 bg-[#00e5a0] hover:bg-[#00c98d] text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-60"
            >
              <Rocket size={14} />
              {isDeploying ? 'Deploy ediliyor...' : 'Deploy to Students'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Quick Templates only */}
          <aside className="w-[220px] bg-[#1a2235] border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Quick Templates</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <p className="text-[9px] text-slate-600 leading-relaxed">
                Science-backed learning patterns. Select one and adjust parameters in the inspector panel.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(TEMPLATES).map(([name, tmpl]) => (
                  <button
                    key={name}
                    onClick={() => applyTemplate(name)}
                    className={cn(
                      "p-3 border rounded-xl transition-all text-left",
                      activePattern === name
                        ? "bg-[#00e5a0]/10 border-[#00e5a0]/40"
                        : "bg-slate-900/50 border-slate-800 hover:border-[#00e5a0]/30 hover:translate-y-[-2px]"
                    )}
                  >
                    <div className="text-[10px] font-bold text-white mb-1 flex items-center justify-between">
                      {name}
                      {activePattern === name && <Check size={10} className="text-[#00e5a0]" />}
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium leading-tight">{tmpl.referenceShort}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 bg-[#0f1623] relative overflow-auto cursor-crosshair custom-scrollbar">
            <div className="min-w-[1400px] min-h-[700px] relative">
              {/* Dot Grid */}
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ 
                  backgroundImage: 'radial-gradient(#00e5a0 1px, transparent 1px)', 
                  backgroundSize: '28px 28px',
                  opacity: 0.03
                }} 
              />

              {/* SVG Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
                  </marker>
                  <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="50%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                </defs>
                {connections.map((conn, idx) => {
                  const fromNode = nodes.find(n => n.id === conn.from);
                  const toNode = nodes.find(n => n.id === conn.to);
                  if (!fromNode || !toNode) return null;

                  const startX = fromNode.x + 180;
                  const startY = fromNode.y + 40;
                  const endX = toNode.x;
                  const endY = toNode.y + 40;

                  const cp1x = startX + (endX - startX) / 2;
                  const cp2x = startX + (endX - startX) / 2;

                  return (
                    <g key={idx}>
                      <path
                        d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
                        stroke="url(#line-gradient)"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                        className="connection-line"
                      />
                      {conn.label && (
                        <foreignObject x={(startX + endX) / 2 - 40} y={(startY + endY) / 2 - 10} width="80" height="20">
                          <div className="flex justify-center items-center h-full">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-lg",
                              conn.label === 'CORRECT' || conn.label === 'PASSED' || conn.label === 'HIGH' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : 
                              conn.label === 'WRONG' || conn.label === 'FAILED' ? "bg-rose-500/10 border-rose-500/30 text-rose-500" :
                              "bg-purple-500/10 border-purple-500/30 text-purple-500"
                            )}>
                              {conn.label}
                            </span>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {nodes.map((node) => {
                const category = Object.values(NODE_CATEGORIES).find(cat => cat.nodes.some(n => n.type === node.type));
                const nodeInfo = category?.nodes.find(n => n.type === node.type);
                const Icon = nodeInfo?.icon || Settings;
                const color = nodeInfo?.color || '#64748b';

                return (
                  <motion.div
                    key={node.id}
                    drag
                    dragMomentum={false}
                    onDrag={(e, info) => {
                      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, x: n.x + info.delta.x, y: n.y + info.delta.y } : n));
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      "absolute w-[180px] bg-[#1a2235] border border-slate-800 rounded-2xl shadow-2xl cursor-grab active:cursor-grabbing transition-all z-10",
                      selectedNodeId === node.id ? "ring-2 ring-[#00e5a0] border-transparent" : "hover:border-slate-700"
                    )}
                    style={{ left: node.x, top: node.y, borderLeft: `4px solid ${color}` }}
                  >


                    {/* Ports */}
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-700 rounded-full border-2 border-[#1a2235] z-20" />
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-700 rounded-full border-2 border-[#1a2235] z-20" />

                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
                          <Icon size={10} />
                        </div>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{node.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[11px] font-bold text-white leading-tight">{node.label}</p>
                    </div>
                  </motion.div>
                );
              })}

              {/* Canvas Background Click Handler */}
              <div className="absolute inset-0" onClick={() => setSelectedNodeId(null)} />
            </div>
          </main>

          {/* Right Panel */}
          <aside className="w-[300px] bg-[#1a2235] border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                {selectedNode ? 'Node Inspector' : 'Student Experience'}
              </h2>
              {selectedNode ? <Settings size={14} className="text-[#00e5a0]" /> : <Eye size={14} className="text-[#00e5a0]" />}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {selectedNode ? (
                <div className="space-y-6">
                  {/* Node type badge — read only */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Node Type</span>
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[9px] font-black">
                      {selectedNode.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-white">{selectedNode.label}</div>

                  <div className="space-y-4">
                    {/* MASTERY_GATE */}
                    {selectedNode.type === 'MASTERY_GATE' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Consecutive correct required:</label>
                        <input
                          type="number" min={1} max={10}
                          value={selectedNode.config?.consecutive_correct ?? 3}
                          onChange={(e) => updateNodeConfig(selectedNode.id, 'consecutive_correct', parseInt(e.target.value))}
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                        />
                        <p className="text-[9px] text-slate-600 mt-1">Student must answer this many in a row before moving on.</p>
                      </div>
                    )}

                    {/* BRANCH */}
                    {selectedNode.type === 'BRANCH' && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Score threshold (%):</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">If score ≥</span>
                          <input
                            type="number" min={0} max={100}
                            value={selectedNode.config?.threshold_score ?? 80}
                            onChange={(e) => updateNodeConfig(selectedNode.id, 'threshold_score', parseInt(e.target.value))}
                            className="w-16 bg-[#0f1623] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                          />
                          <span className="text-[10px] text-slate-500">% → Correct path</span>
                        </div>
                        <p className="text-[9px] text-slate-600">Below threshold → Hint path.</p>
                      </div>
                    )}

                    {/* SCORE_CHECK */}
                    {selectedNode.type === 'SCORE_CHECK' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Score threshold (%):</label>
                        <input
                          type="number" min={0} max={100}
                          value={selectedNode.config?.threshold_score ?? 70}
                          onChange={(e) => updateNodeConfig(selectedNode.id, 'threshold_score', parseInt(e.target.value))}
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                        />
                        <p className="text-[9px] text-slate-600 mt-1">HIGH path if score ≥ threshold, LOW path otherwise.</p>
                      </div>
                    )}

                    {/* SPACED_REVIEW */}
                    {selectedNode.type === 'SPACED_REVIEW' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Review intervals (days):</label>
                        <div className="flex gap-2">
                          {(selectedNode.config?.review_days ?? [1, 3, 7]).map((day: number, i: number) => (
                            <input
                              key={i} type="number" min={1}
                              value={day}
                              onChange={(e) => {
                                const days = [...(selectedNode.config?.review_days ?? [1, 3, 7])];
                                days[i] = parseInt(e.target.value);
                                updateNodeConfig(selectedNode.id, 'review_days', days);
                              }}
                              className="flex-1 bg-[#0f1623] border border-slate-800 rounded-xl py-2 text-center text-xs font-bold text-[#00e5a0] outline-none focus:ring-1 focus:ring-[#00e5a0]"
                            />
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-600 mt-1">Days after initial learning when review is triggered.</p>
                      </div>
                    )}

                    {/* HINT */}
                    {selectedNode.type === 'HINT' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Max hints before answer reveal:</label>
                        <input
                          type="number" min={1} max={5}
                          value={selectedNode.config?.max_hints ?? 2}
                          onChange={(e) => updateNodeConfig(selectedNode.id, 'max_hints', parseInt(e.target.value))}
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                        />
                        <p className="text-[9px] text-slate-600 mt-1">Student sees this many hints before the answer is shown.</p>
                      </div>
                    )}

                    {/* No config nodes */}
                    {!['MASTERY_GATE', 'BRANCH', 'SCORE_CHECK', 'SPACED_REVIEW', 'HINT'].includes(selectedNode.type) && (
                      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <p className="text-[10px] text-slate-500">No configurable parameters for this node type.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Student sees</div>
                    <p className="text-[10px] text-slate-400">
                      {selectedNode.type === 'LESSON' && 'The core educational content.'}
                      {selectedNode.type === 'CONCEPTUAL' && 'A thought-provoking question to test understanding.'}
                      {selectedNode.type === 'MULTIPLE_CHOICE' && 'A multiple-choice question with instant feedback.'}
                      {selectedNode.type === 'CODING' && 'A coding task with a live editor.'}
                      {selectedNode.type === 'HINT' && 'A subtle nudge to help them solve the problem.'}
                      {selectedNode.type === 'EXPLANATION' && 'A full explanation of the correct answer.'}
                      {selectedNode.type === 'WORKED_EXAMPLE' && 'A step-by-step worked solution.'}
                      {selectedNode.type === 'BRANCH' && 'A seamless transition based on their score.'}
                      {selectedNode.type === 'MASTERY_GATE' && 'Must answer correctly N times in a row.'}
                      {selectedNode.type === 'SCORE_CHECK' && 'Routed to advanced or intro path based on score.'}
                      {selectedNode.type === 'SPACED_REVIEW' && 'A reminder to review on scheduled days.'}
                      {selectedNode.type === 'MARK_DONE' && 'Module completion confirmation.'}
                      {selectedNode.type === 'NEXT_SECTION' && 'Auto-advance to the next section.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-[#0f1623] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#00e5a0]">
                        <Sparkles size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">AI Summary</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!savedFlowId) {
                            setToastMessage('Önce flow\'u kaydedin (Save Draft)');
                            setToastType('error');
                            setShowDeployToast(true);
                            setTimeout(() => setShowDeployToast(false), 3000);
                            return;
                          }
                          setIsGeneratingSummary(true);
                          try {
                            const { api } = await import('../api/client');
                            const res = await api.post<{ summary: string }>(`/flows/${savedFlowId}/summary`, {});
                            setAiSummary(res.summary);
                          } catch (e) {
                            setAiSummary('Özet üretilirken hata oluştu. Lütfen tekrar deneyin.');
                          } finally {
                            setIsGeneratingSummary(false);
                          }
                        }}
                        disabled={isGeneratingSummary}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-[9px] font-bold text-emerald-400 uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {isGeneratingSummary ? (
                          <><RefreshCw size={10} className="animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles size={10} /> Generate</>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed italic">
                      {aiSummary || (
                        <span className="text-slate-600">
                          Click "Generate" to get an AI-powered pedagogical analysis of this flow.
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Flow Stats</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0f1623] border border-slate-800 p-3 rounded-xl">
                        <div className="text-[18px] font-bold text-white">{stats.nodes}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Nodes</div>
                      </div>
                      <div className="bg-[#0f1623] border border-slate-800 p-3 rounded-xl">
                        <div className="text-[18px] font-bold text-white">{stats.decisions}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Decisions</div>
                      </div>
                    </div>
                    <div className="p-3 bg-[#0f1623] border border-slate-800 rounded-xl flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Pattern</span>
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[9px] font-black uppercase tracking-widest">
                        {activePattern.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {activeClass && (
                      <div className="p-3 bg-[#0f1623] border border-slate-800 rounded-xl flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Deployed to</span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black">
                          {activeClass.class_code} — {activeClass.total_students} öğrenci
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={12} />
                      Pattern Reference
                    </div>
                    {(() => {
                      const tmpl = TEMPLATES[activePattern as keyof typeof TEMPLATES];
                      return tmpl ? (
                        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                          <p className="text-[10px] text-slate-400 italic leading-relaxed">📄 {tmpl.reference}</p>
                          <a
                            href={tmpl.referenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-all group"
                          >
                            <ExternalLink size={12} className="group-hover:scale-110 transition-transform" />
                            {tmpl.referenceShort}
                          </a>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                          <p className="text-[10px] text-slate-500 italic">Select a template to view its research reference.</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Status Bar */}
        <footer className="h-10 bg-[#0d1220] border-t border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              {stats.nodes} Nodes
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {stats.decisions} Decision Points
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              {stats.connections} Connections
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-black tracking-widest border",
              flowStatus === 'DRAFT' && "bg-slate-800 border-slate-700 text-slate-400",
              flowStatus === 'SAVED' && "bg-blue-500/10 border-blue-500/30 text-blue-400",
              flowStatus === 'LIVE' && "bg-[#00e5a0]/10 border-[#00e5a0]/30 text-[#00e5a0]"
            )}>
              {flowStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
              <Check size={12} />
              Flow is valid
            </div>
          </div>
        </footer>
      </div>

      {/* Toast — Save / Deploy / Error */}
      <AnimatePresence>
        {showDeployToast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={cn(
              "fixed bottom-16 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-3",
              toastType === 'success'
                ? "bg-[#00e5a0] text-slate-950"
                : "bg-rose-500 text-white"
            )}
          >
            {toastType === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
        .connection-line {
          stroke-dasharray: 8;
          animation: dash 30s linear infinite;
        }
        @keyframes dash {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

export default FlowDesignerPage;
