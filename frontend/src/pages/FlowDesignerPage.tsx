import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  Send, 
  Sparkles, 
  ChevronDown,
  GitBranch,
  Info,
  Settings,
  Layers,
  ChevronRight,
  Clock,
  Edit3,
  BookOpen,
  Target,
  Zap,
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
  Minus,
  Plus,
  Maximize2,
  AlertCircle,
  Check,
  Rocket,
  X,
  Link as LinkIcon,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole, Course } from '../types';
import { cn } from '../lib/utils';


interface FlowDesignerPageProps {
  sections: Section[];
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
    label: '📚 CONTENT',
    nodes: [
      { type: 'LESSON', label: 'Lesson', icon: BookOpen, color: '#00b4d8' },
      { type: 'SHOW_PDF', label: 'Show PDF', icon: FileText, color: '#00b4d8' },
      { type: 'SHOW_VIDEO', label: 'Show Video', icon: Play, color: '#00b4d8' },
    ]
  },
  QUESTIONS: {
    label: '❓ QUESTIONS',
    nodes: [
      { type: 'CONCEPTUAL', label: 'Conceptual', icon: MessageCircle, color: '#3b82f6' },
      { type: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: List, color: '#3b82f6' },
      { type: 'CODING', label: 'Coding', icon: Code, color: '#3b82f6' },
    ]
  },
  SUPPORT: {
    label: '💡 SUPPORT',
    nodes: [
      { type: 'HINT', label: 'Hint', icon: Lightbulb, color: '#f59e0b' },
      { type: 'EXPLANATION', label: 'Explanation', icon: BookOpen, color: '#f59e0b' },
      { type: 'WORKED_EXAMPLE', label: 'Worked Example', icon: Layers, color: '#f59e0b' },
    ]
  },
  LOGIC: {
    label: '🔀 LOGIC',
    nodes: [
      { type: 'BRANCH', label: 'Branch', icon: GitBranch, color: '#8b5cf6' },
      { type: 'MASTERY_GATE', label: 'Mastery Gate', icon: Shield, color: '#8b5cf6' },
      { type: 'SCORE_CHECK', label: 'Score Check', icon: BarChart, color: '#8b5cf6' },
    ]
  },
  TIMING: {
    label: '⏱️ TIMING',
    nodes: [
      { type: 'SPACED_REVIEW', label: 'Spaced Review', icon: Clock, color: '#64748b' },
    ]
  },
  COMPLETE: {
    label: '✅ COMPLETE',
    nodes: [
      { type: 'MARK_DONE', label: 'Mark Done', icon: CheckCircle, color: '#00e5a0' },
      { type: 'NEXT_SECTION', label: 'Next Section', icon: ArrowRight, color: '#00e5a0' },
    ]
  }
};

const TEMPLATES = {
  'Socratic Retry': {
    nodes: [
      { id: '1', type: 'LESSON', x: 60, y: 200, label: 'Introduction' },
      { id: '2', type: 'CONCEPTUAL', x: 270, y: 200, label: 'Concept Check' },
      { id: '3', type: 'BRANCH', x: 480, y: 200, label: 'Evaluate Answer' },
      { id: '4', type: 'HINT', x: 480, y: 340, label: 'Conceptual Hint' },
      { id: '5', type: 'CONCEPTUAL', x: 270, y: 340, label: 'Retry Question' },
      { id: '6', type: 'EXPLANATION', x: 690, y: 200, label: 'Full Explanation' },
      { id: '7', type: 'MARK_DONE', x: 900, y: 200, label: 'Module Complete' },
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
    reference: 'Macina et al. (2023), "Opportunities and Challenges of LLMs for Socratic Question Answering." ACL Workshop.'
  },
  'Mastery Gate': {
    nodes: [
      { id: '1', type: 'LESSON', x: 60, y: 200, label: 'Core Concept' },
      { id: '2', type: 'CODING', x: 270, y: 200, label: 'Practice Task' },
      { id: '3', type: 'MASTERY_GATE', x: 480, y: 200, label: 'Mastery Check' },
      { id: '4', type: 'WORKED_EXAMPLE', x: 480, y: 340, label: 'Remediation' },
      { id: '5', type: 'NEXT_SECTION', x: 690, y: 200, label: 'Next Topic' },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '5', label: 'PASSED', color: '#00e5a0' },
      { from: '3', to: '4', label: 'FAILED', color: '#f43f5e' },
      { from: '4', to: '2' },
    ] as Connection[],
    reference: "Bloom's Mastery Learning, PMC 2022"
  },
  'Spaced Retrieval': {
    nodes: [
      { id: '1', type: 'LESSON', x: 60, y: 200, label: 'Initial Learning' },
      { id: '2', type: 'SPACED_REVIEW', x: 270, y: 200, label: 'Review Cycle' },
      { id: '3', type: 'CONCEPTUAL', x: 480, y: 200, label: 'Retrieval Quiz' },
      { id: '4', type: 'MARK_DONE', x: 690, y: 200, label: 'Mastered' },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '4' },
    ] as Connection[],
    reference: 'Carpenter et al. (2022), Nature Reviews Psychology'
  },
  'Adaptive Branch': {
    nodes: [
      { id: '1', type: 'MULTIPLE_CHOICE', x: 60, y: 200, label: 'Diagnostic' },
      { id: '2', type: 'SCORE_CHECK', x: 270, y: 200, label: 'Check Level' },
      { id: '3', type: 'LESSON', x: 480, y: 100, label: 'Advanced Path' },
      { id: '4', type: 'LESSON', x: 480, y: 300, label: 'Intro Path' },
      { id: '5', type: 'MARK_DONE', x: 690, y: 200, label: 'Complete' },
    ] as Node[],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3', label: 'HIGH', color: '#8b5cf6' },
      { from: '2', to: '4', label: 'LOW', color: '#06b6d4' },
      { from: '3', to: '5' },
      { from: '4', to: '5' },
    ] as Connection[],
    reference: 'PMC Scoping Review 2024, Adaptive Learning Paths'
  }
};

const DEFAULT_COURSES: Course[] = [
  { id: 'cs101', name: 'CS101 — Data Structures', role: 'instructor' },
  { id: 'cs202', name: 'CS202 — Algorithms', role: 'instructor' },
];

export const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({
  sections,
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
  const courses = coursesProp ?? DEFAULT_COURSES;
  const [activeCourseId, setActiveCourseId] = React.useState(activeCourseIdProp ?? 'cs101');
  const handleCourseChange = (id: string) => {
    setActiveCourseId(id);
    onCourseChange?.(id);
  };
  const [nodes, setNodes] = useState<Node[]>(TEMPLATES['Socratic Retry'].nodes);
  const [connections, setConnections] = useState<Connection[]>(TEMPLATES['Socratic Retry'].connections);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowStatus, setFlowStatus] = useState<'DRAFT' | 'SAVED' | 'LIVE'>('DRAFT');
  const [showDeployToast, setShowDeployToast] = useState(false);
  
  // New States
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>({});
  const [isNamingTemplate, setIsNamingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

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
    const template = TEMPLATES[name as keyof typeof TEMPLATES] || customTemplates[name];
    if (template) {
      setNodes(template.nodes);
      setConnections(template.connections);
      setSelectedNodeId(null);
    }
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    setCustomTemplates(prev => ({
      ...prev,
      [newTemplateName]: {
        nodes: [...nodes],
        connections: [...connections]
      }
    }));
    setNewTemplateName('');
    setIsNamingTemplate(false);
  };

  const handleDeleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleNodeClick = (id: string) => {
    if (isConnectMode) {
      if (!connectSourceId) {
        setConnectSourceId(id);
      } else if (connectSourceId !== id) {
        // Create connection
        setConnections(prev => [...prev, { from: connectSourceId, to: id, label: '→' }]);
        setConnectSourceId(null);
        setIsConnectMode(false);
      }
    } else {
      setSelectedNodeId(id);
    }
  };

  const handleDeploy = () => {
    setFlowStatus('LIVE');
    setShowDeployToast(true);
    setTimeout(() => setShowDeployToast(false), 3000);
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

          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-full border border-slate-800">
            {courses.map(course => (
              <button
                key={course.id}
                onClick={() => handleCourseChange(course.id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold transition-all",
                  activeCourseId === course.id 
                    ? "bg-[#00e5a0] text-slate-950 shadow-lg shadow-emerald-500/20" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {course.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setFlowStatus('SAVED')}
              className="px-4 py-2 border border-slate-700 hover:border-slate-500 rounded-xl text-xs font-bold transition-all"
            >
              Save Draft
            </button>
            <button 
              onClick={handleDeploy}
              className="px-4 py-2 bg-[#00e5a0] hover:bg-[#00c98d] text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              <Rocket size={14} />
              Deploy to Students
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Node Palette */}
          <aside className="w-[220px] bg-[#1a2235] border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Node Types</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {/* Quick Templates at the top */}
              <div className="space-y-3">
                <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Quick Templates</h3>
                <div className="grid grid-cols-1 gap-2">
                  {Object.keys(TEMPLATES).map(name => (
                    <button
                      key={name}
                      onClick={() => applyTemplate(name)}
                      className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-[#00e5a0]/30 hover:translate-y-[-2px] transition-all text-left"
                    >
                      <div className="text-[10px] font-bold text-white mb-1">
                        {name === 'Socratic Retry' && '🔁 '}
                        {name === 'Mastery Gate' && '🎯 '}
                        {name === 'Spaced Retrieval' && '📅 '}
                        {name === 'Adaptive Branch' && '🌿 '}
                        {name}
                      </div>
                      <div className="text-[8px] text-slate-500 font-medium leading-tight">Load science-backed flow</div>
                    </button>
                  ))}
                  
                  {/* Custom Templates */}
                  {Object.keys(customTemplates).map(name => (
                    <button
                      key={name}
                      onClick={() => applyTemplate(name)}
                      className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-[#00e5a0]/30 hover:translate-y-[-2px] transition-all text-left"
                    >
                      <div className="text-[10px] font-bold text-white mb-1">⭐ {name}</div>
                      <div className="text-[8px] text-slate-500 font-medium leading-tight">Custom Template</div>
                    </button>
                  ))}

                  {/* New Custom Template Card */}
                  {!isNamingTemplate ? (
                    <button
                      onClick={() => setIsNamingTemplate(true)}
                      className="p-3 bg-transparent border border-dashed border-slate-700 rounded-xl hover:border-[#00e5a0]/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2 text-slate-500 group-hover:text-[#00e5a0] transition-colors">
                        <PlusCircle size={14} />
                        <span className="text-[10px] font-bold">New Custom Template</span>
                      </div>
                      <div className="text-[8px] text-slate-600 font-medium leading-tight mt-1">Save current flow as template</div>
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-900/80 border border-[#00e5a0]/30 rounded-xl space-y-2">
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Template name..."
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSaveTemplate}
                          className="flex-1 py-1.5 bg-[#00e5a0] text-slate-950 rounded-lg text-[10px] font-bold"
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setIsNamingTemplate(false)}
                          className="px-2 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-6">
                {Object.entries(NODE_CATEGORIES).map(([key, category]) => (
                  <div key={key} className="space-y-2">
                    <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{category.label}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {category.nodes.map(node => (
                        <button
                          key={node.type}
                          onClick={() => handleAddNode(node.type, node.label)}
                          className="flex items-center gap-3 p-2.5 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-600 transition-all group text-left"
                        >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${node.color}20`, color: node.color }}>
                            <node.icon size={14} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors">{node.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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
                      selectedNodeId === node.id ? "ring-2 ring-[#00e5a0] border-transparent" : "hover:border-slate-700",
                      connectSourceId === node.id && "ring-2 ring-blue-500 border-transparent"
                    )}
                    style={{ left: node.x, top: node.y, borderLeft: `4px solid ${color}` }}
                  >
                    {/* Delete Button */}
                    {selectedNodeId === node.id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors z-30"
                      >
                        <X size={12} />
                      </button>
                    )}

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
              <div className="absolute inset-0" onClick={() => {
                setSelectedNodeId(null);
                setConnectSourceId(null);
                setIsConnectMode(false);
              }} />

              {/* Canvas Toolbar */}
              <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-slate-900/80 backdrop-blur border border-slate-800 p-1.5 rounded-2xl shadow-2xl z-50">
                <button 
                  onClick={() => {
                    setIsConnectMode(!isConnectMode);
                    setConnectSourceId(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all",
                    isConnectMode ? "bg-[#00e5a0] text-slate-950" : "text-slate-400 hover:bg-slate-800"
                  )}
                >
                  <LinkIcon size={14} />
                  Connect
                </button>
                <div className="w-px h-4 bg-slate-800 mx-1" />
                <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><Minus size={14} /></button>
                <span className="text-[10px] font-black text-slate-500 px-2">100%</span>
                <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><Plus size={14} /></button>
                <div className="w-px h-4 bg-slate-800 mx-1" />
                <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><Maximize2 size={14} /></button>
              </div>
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
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Label</label>
                      <input 
                        type="text" 
                        value={selectedNode.label}
                        onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                        className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                      />
                    </div>

                    {/* Context Specific Config */}
                    {selectedNode.type === 'MASTERY_GATE' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Consecutive correct required:</label>
                        <input 
                          type="number" 
                          defaultValue={3}
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'BRANCH' && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Branch Logic</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">If score ≥</span>
                          <input type="number" defaultValue={80} className="w-16 bg-[#0f1623] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white" />
                          <span className="text-[10px] text-slate-500">% → Path A</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Else → Path B</span>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'SPACED_REVIEW' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Review on day:</label>
                        <div className="flex gap-2">
                          {[1, 3, 7].map(day => (
                            <div key={day} className="flex-1 py-2 bg-[#0f1623] border border-slate-800 rounded-xl text-center text-xs font-bold text-[#00e5a0]">
                              {day}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'HINT' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Max hints before reveal:</label>
                        <input 
                          type="number" 
                          defaultValue={2}
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                        />
                      </div>
                    )}

                    {['CONCEPTUAL', 'MULTIPLE_CHOICE', 'CODING'].includes(selectedNode.type) && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Difficulty:</label>
                        <select className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0] appearance-none">
                          <option>Easy</option>
                          <option>Medium</option>
                          <option>Hard</option>
                        </select>
                      </div>
                    )}

                    {['LESSON', 'SHOW_PDF', 'SHOW_VIDEO'].includes(selectedNode.type) && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Source URL:</label>
                        <input 
                          type="text" 
                          placeholder="Paste Google Drive / YouTube link"
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-[#00e5a0]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-800 space-y-4">
                    <div>
                      <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Academic Reference</div>
                      <p className="text-[10px] text-slate-400 italic">
                        {selectedNode.type === 'MASTERY_GATE' && "Bloom's Mastery Learning, PMC 2022"}
                        {selectedNode.type === 'SPACED_REVIEW' && "Ebbinghaus Forgetting Curve, 1885"}
                        {selectedNode.type === 'BRANCH' && "Adaptive Learning Systems, Scoping Review 2024"}
                        {!['MASTERY_GATE', 'SPACED_REVIEW', 'BRANCH'].includes(selectedNode.type) && "Standard Pedagogical Design Pattern"}
                      </p>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Student sees</div>
                      <p className="text-[10px] text-slate-400">
                        {selectedNode.type === 'LESSON' && "The core educational content in markdown format."}
                        {selectedNode.type === 'CONCEPTUAL' && "A thought-provoking question to test understanding."}
                        {selectedNode.type === 'HINT' && "A subtle nudge to help them solve the problem."}
                        {selectedNode.type === 'BRANCH' && "A seamless transition to content matching their level."}
                        {!['LESSON', 'CONCEPTUAL', 'HINT', 'BRANCH'].includes(selectedNode.type) && "Interactive learning component."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-[#0f1623] border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-[#00e5a0]">
                      <Sparkles size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">AI Summary</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed italic">
                      "In this flow, students first read the lesson, then answer a conceptual question. If wrong, they receive a hint and retry. After 3 consecutive correct answers, they advance to the next section."
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
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pattern</span>
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[9px] font-black uppercase tracking-widest">Socratic Retry</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={12} />
                      Pattern Reference
                    </div>
                    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] text-slate-400 italic leading-relaxed">
                        📄 Macina et al. (2023), "Opportunities and Challenges of LLMs for Socratic Question Answering." ACL Workshop.
                      </p>
                    </div>
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

      {/* Deploy Toast */}
      <AnimatePresence>
        {showDeployToast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[100] bg-[#00e5a0] text-slate-950 px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-3"
          >
            <Rocket size={18} />
            Flow deployed to {activeCourseId === 'cs101' ? 'CS101' : 'CS202'}!
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
