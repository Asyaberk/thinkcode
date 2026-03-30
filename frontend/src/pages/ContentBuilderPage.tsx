import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Save, 
  Send, 
  Upload, 
  FileText, 
  Video, 
  Link as LinkIcon, 
  Trash2, 
  Edit3, 
  Sparkles, 
  ChevronRight, 
  ChevronDown,
  LayoutDashboard,
  Play,
  HelpCircle,
  Lightbulb,
  RefreshCw,
  Info,
  ArrowRight,
  Settings,
  MousePointer2,
  FileUp,
  X,
  CheckCircle2,
  Zap,
  Layers,
  GitBranch,
  MessageSquare
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';

interface ContentBuilderPageProps {
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

type NodeType = 'Question' | 'Hint' | 'Show Content' | 'Retry' | 'Evaluate';

interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
}

interface Connection {
  from: string;
  to: string;
  label?: string;
  color?: string;
}

const INITIAL_NODES: Node[] = [
  { id: '1', type: 'Question', x: 100, y: 150, label: 'Intro to Pointers' },
  { id: '2', type: 'Evaluate', x: 350, y: 150, label: 'Check Answer' },
  { id: '3', type: 'Hint', x: 350, y: 300, label: 'Memory Address Hint' },
  { id: '4', type: 'Retry', x: 100, y: 300, label: 'Try Again' },
  { id: '5', type: 'Show Content', x: 600, y: 150, label: 'Next Topic' },
];

const INITIAL_CONNECTIONS: Connection[] = [
  { from: '1', to: '2' },
  { from: '2', to: '5', label: 'Correct', color: '#10b981' },
  { from: '2', to: '3', label: 'Wrong', color: '#ef4444' },
  { from: '3', to: '4' },
  { from: '4', to: '1' },
];

export const ContentBuilderPage: React.FC<ContentBuilderPageProps> = ({
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
  const [activeTab, setActiveTab] = useState<'Topics' | 'Lessons' | 'Questions' | 'Misconceptions'>('Topics');
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [connections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, type: string }[]>([
    { name: 'Pointers_Deep_Dive.pdf', type: 'PDF' },
    { name: 'Memory_Management_Lecture.mp4', type: 'Video' }
  ]);

  const handleProcessResources = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const renderTabContent = () => {
    const items = {
      Topics: ['Memory Addresses', 'Pointer Declaration', 'Dereferencing', 'Pointer Arithmetic'],
      Lessons: ['What is a Pointer?', 'The & and * Operators', 'Null Pointers', 'Void Pointers'],
      Questions: ['Identify the output of *p', 'Declare a pointer to an int', 'What does &x return?'],
      Misconceptions: ['Pointers are the same as arrays', 'Dereferencing a null pointer is safe']
    };

    return (
      <div className="space-y-3">
        {items[activeTab].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                {activeTab === 'Topics' && <Layers size={16} />}
                {activeTab === 'Lessons' && <FileText size={16} />}
                {activeTab === 'Questions' && <HelpCircle size={16} />}
                {activeTab === 'Misconceptions' && <Zap size={16} />}
              </div>
              <span className="text-sm font-medium text-slate-300">{item}</span>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                <Edit3 size={14} />
              </button>
              <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
        <button className="w-full py-3 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-2 text-sm font-bold">
          <Plus size={16} />
          Add {activeTab.slice(0, -1)}
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden">
      <Sidebar 
        sections={sections}
        activeSectionId="content-builder"
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
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
          {/* Top Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Content & Learning Flow Builder</h1>
              <p className="text-slate-400 text-lg font-medium">Create AI-powered courses from your materials</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-slate-700">
                <Save size={18} />
                Save Draft
              </button>
              <button className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                <Send size={18} />
                Publish
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Resources & AI Content */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              {/* Resource Upload Section */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileUp size={20} className="text-emerald-500" />
                    Resources
                  </h2>
                </div>

                <div className="border-2 border-dashed border-slate-800 rounded-3xl p-8 text-center hover:border-emerald-500/50 transition-all group cursor-pointer bg-slate-900/20">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500 group-hover:text-emerald-500 transition-colors">
                    <Upload size={32} />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Drop files here or click to upload</p>
                  <p className="text-xs text-slate-500">PDF, Text, or Video links supported</p>
                </div>

                <div className="space-y-3">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-emerald-500">
                          {file.type === 'PDF' ? <FileText size={20} /> : <Video size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-200">{file.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{file.type}</p>
                        </div>
                      </div>
                      <button className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleProcessResources}
                  disabled={isProcessing}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="text-emerald-500" />
                      Process Resources
                    </>
                  )}
                </button>
              </section>

              {/* AI Generated Content */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles size={20} className="text-emerald-500" />
                    AI Content
                  </h2>
                </div>

                <div className="flex p-1 bg-slate-950 rounded-xl">
                  {['Topics', 'Lessons', 'Questions', 'Misconceptions'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={cn(
                        "flex-1 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all",
                        activeTab === tab ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {renderTabContent()}
                </div>
              </section>
            </div>

            {/* Right Column: Flow Builder */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              {/* Learning Flow Builder */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 h-[800px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 z-10">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <GitBranch size={20} className="text-emerald-500" />
                      Learning Flow Builder
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Design the student journey logic</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                      <MousePointer2 size={18} />
                    </button>
                    <button className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                      <Layers size={18} />
                    </button>
                    <button className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                      <Settings size={18} />
                    </button>
                  </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-slate-950/50 rounded-3xl border border-slate-800 relative overflow-hidden cursor-crosshair">
                  {/* Grid background */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                  
                  {/* Connections (SVG) */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#334155" />
                      </marker>
                    </defs>
                    {connections.map((conn, idx) => {
                      const fromNode = nodes.find(n => n.id === conn.from);
                      const toNode = nodes.find(n => n.id === conn.to);
                      if (!fromNode || !toNode) return null;

                      const startX = fromNode.x + 160;
                      const startY = fromNode.y + 40;
                      const endX = toNode.x;
                      const endY = toNode.y + 40;

                      return (
                        <g key={idx}>
                          <path
                            d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`}
                            stroke={conn.color || '#334155'}
                            strokeWidth="2"
                            fill="none"
                            markerEnd="url(#arrowhead)"
                            className="transition-all duration-500"
                          />
                          {conn.label && (
                            <foreignObject x={(startX + endX) / 2 - 40} y={(startY + endY) / 2 - 10} width="80" height="20">
                              <div className="flex justify-center">
                                <span className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                  conn.label === 'Correct' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-red-500/10 border-red-500/30 text-red-500"
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
                  {nodes.map((node) => (
                    <motion.div
                      key={node.id}
                      drag
                      dragMomentum={false}
                      onDrag={(e, info) => {
                        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, x: n.x + info.delta.x, y: n.y + info.delta.y } : n));
                      }}
                      onClick={() => setSelectedNode(node.id)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "absolute w-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl cursor-grab active:cursor-grabbing transition-all",
                        selectedNode === node.id ? "ring-2 ring-emerald-500 border-emerald-500/50" : "hover:border-slate-700"
                      )}
                      style={{ left: node.x, top: node.y }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center",
                          node.type === 'Question' && "bg-blue-500/10 text-blue-500",
                          node.type === 'Evaluate' && "bg-purple-500/10 text-purple-500",
                          node.type === 'Hint' && "bg-amber-500/10 text-amber-500",
                          node.type === 'Retry' && "bg-red-500/10 text-red-500",
                          node.type === 'Show Content' && "bg-emerald-500/10 text-emerald-500",
                        )}>
                          {node.type === 'Question' && <HelpCircle size={14} />}
                          {node.type === 'Evaluate' && <CheckCircle2 size={14} />}
                          {node.type === 'Hint' && <Lightbulb size={14} />}
                          {node.type === 'Retry' && <RefreshCw size={14} />}
                          {node.type === 'Show Content' && <Play size={14} />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{node.type}</span>
                      </div>
                      <p className="text-xs font-bold text-white leading-tight">{node.label}</p>
                    </motion.div>
                  ))}

                  {/* Node Toolbar */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2 flex gap-2 shadow-2xl z-20">
                    {['Question', 'Hint', 'Show Content', 'Retry', 'Evaluate'].map((type) => (
                      <button
                        key={type}
                        className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 transition-all group relative"
                      >
                        {type === 'Question' && <HelpCircle size={20} />}
                        {type === 'Hint' && <Lightbulb size={20} />}
                        {type === 'Show Content' && <Play size={20} />}
                        {type === 'Retry' && <RefreshCw size={20} />}
                        {type === 'Evaluate' && <CheckCircle2 size={20} />}
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Add {type}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Predefined Flow Patterns */}
                <div className="absolute top-8 right-8 w-64 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers size={16} className="text-emerald-500" />
                    <h3 className="text-sm font-bold text-white">Flow Patterns</h3>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Pattern</label>
                    <div className="relative">
                      <select className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 appearance-none focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option>Retry Loop</option>
                        <option>Hint Escalation</option>
                        <option>Show Concept → Retry</option>
                        <option>Branching Logic</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2">
                    Apply Pattern
                    <ArrowRight size={14} />
                  </button>
                </div>

                {/* AI Flow Generator */}
                <div className="mt-8 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">AI Flow Generator</h3>
                      <p className="text-sm text-slate-500 font-medium">Generate a complete learning journey based on your resources</p>
                    </div>
                  </div>
                  <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-slate-700">
                    <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                    Generate with AI
                  </button>
                </div>
              </section>

              {/* Bottom Section: Flow Explanation */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 flex gap-8">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={20} className="text-emerald-500" />
                    <h2 className="text-xl font-bold text-white">Flow Explanation</h2>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl">
                    <p className="text-slate-400 leading-relaxed italic font-serif">
                      "This flow starts with an introductory question on pointers. If the student answers incorrectly, the system provides a conceptual hint about memory addresses. After the hint, the student is prompted to retry the question. Upon a correct answer, the flow evaluates the mastery and proceeds to the next topic: Pointer Declaration."
                    </p>
                  </div>
                </div>
                <div className="w-64 space-y-4">
                  <div className="flex items-center gap-2">
                    <Info size={20} className="text-slate-500" />
                    <h3 className="text-sm font-bold text-white">AI Insights</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Complexity</p>
                      <p className="text-xs font-medium text-slate-300">Moderate - 5 nodes</p>
                    </div>
                    <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Est. Time</p>
                      <p className="text-xs font-medium text-slate-300">8-12 minutes</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContentBuilderPage;
