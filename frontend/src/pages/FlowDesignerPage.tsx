import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Save, 
  Send, 
  Sparkles, 
  ChevronDown,
  Info,
  Layers,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';

interface FlowDesignerPageProps {
  sections: Section[];
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

type NodeType = 'QUESTION' | 'EVALUATE' | 'HINT' | 'RETRY' | 'SHOW_CONTENT' | 'COMPLETE';

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
  { id: '1', type: 'QUESTION', x: 100, y: 150, label: 'What is a pointer?' },
  { id: '2', type: 'EVALUATE', x: 300, y: 150, label: 'Check Logic' },
  { id: '3', type: 'HINT', x: 300, y: 300, label: 'Memory Address Hint' },
  { id: '4', type: 'RETRY', x: 100, y: 300, label: 'Retry Question' },
  { id: '5', type: 'SHOW_CONTENT', x: 500, y: 150, label: 'Pointer Syntax' },
  { id: '6', type: 'COMPLETE', x: 700, y: 150, label: 'Module Done' },
];

const INITIAL_CONNECTIONS: Connection[] = [
  { from: '1', to: '2' },
  { from: '2', to: '5', label: 'Correct', color: '#00e5a0' },
  { from: '2', to: '3', label: 'Wrong', color: '#f43f5e' },
  { from: '3', to: '4' },
  { from: '4', to: '1' },
  { from: '5', to: '6' },
];

export const FlowDesignerPage: React.FC<FlowDesignerPageProps> = ({
  sections,
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
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [connections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

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

      <main className="flex-1 overflow-hidden ml-72 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0f1623]">
          <div>
            <h1 className="text-xl font-bold text-white">Learning Flow Designer</h1>
            <p className="text-xs text-slate-500">Visualizing the student journey for "C++ Pointers"</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-slate-700">
              <Save size={14} />
              Save Flow
            </button>
            <button className="px-4 py-2 bg-[#00e5a0] hover:bg-[#00c98d] text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
              <Send size={14} />
              Deploy to Course
            </button>
          </div>
        </div>

        {/* Designer Area */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          
          {/* Canvas (Main Area) */}
          <div className="flex-1 bg-[#0f1623] rounded-3xl border border-slate-800 relative overflow-hidden cursor-crosshair group/canvas shadow-2xl">
            {/* Grid */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00e5a0 0.5px, transparent 0.5px)', backgroundSize: '30px 30px' }} />
            
            {/* Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <marker id="arrowhead-designer" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
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
                      markerEnd="url(#arrowhead-designer)"
                    />
                    {conn.label && (
                      <foreignObject x={(startX + endX) / 2 - 40} y={(startY + endY) / 2 - 10} width="80" height="20">
                        <div className="flex justify-center">
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            conn.label === 'Correct' ? "bg-[#00e5a0]/10 border-[#00e5a0]/30 text-[#00e5a0]" : "bg-red-500/10 border-red-500/30 text-red-500"
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
                onDrag={(_e, info) => {
                  setNodes(prev => prev.map(n => n.id === node.id ? { ...n, x: n.x + info.delta.x, y: n.y + info.delta.y } : n));
                }}
                onClick={() => setSelectedNode(node.id)}
                className={cn(
                  "absolute w-40 bg-[#1a2235] border border-slate-800 rounded-2xl p-4 shadow-2xl cursor-grab active:cursor-grabbing transition-all",
                  selectedNode === node.id ? "ring-2 ring-[#00e5a0] border-[#00e5a0]/50" : "hover:border-slate-700"
                )}
                style={{ left: node.x, top: node.y }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold",
                    node.type === 'QUESTION' && "bg-blue-500/20 text-blue-400",
                    node.type === 'EVALUATE' && "bg-purple-500/20 text-purple-400",
                    node.type === 'HINT' && "bg-amber-500/20 text-amber-400",
                    node.type === 'RETRY' && "bg-orange-500/20 text-orange-400",
                    node.type === 'SHOW_CONTENT' && "bg-teal-500/20 text-teal-400",
                    node.type === 'COMPLETE' && "bg-[#00e5a0]/20 text-[#00e5a0]",
                  )}>
                    {node.type[0]}
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{node.type}</span>
                </div>
                <p className="text-xs font-bold text-white leading-tight">{node.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Right Sidebar (Controls) */}
          <div className="w-80 flex flex-col gap-6">
            {/* Flow Patterns */}
            <div className="bg-[#1a2235] rounded-3xl border border-slate-800 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <Layers size={18} className="text-[#00e5a0]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Flow Patterns</h3>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <select className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 appearance-none outline-none focus:ring-1 focus:ring-[#00e5a0]">
                    <option>Retry Loop</option>
                    <option>Socratic Method</option>
                    <option>Hint-First Path</option>
                    <option>Mastery Checkpoint</option>
                    <option>Adaptive Branching</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                </div>
                <button className="w-full py-3 bg-[#00e5a0] hover:bg-[#00c98d] text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-[#00e5a0]/10">
                  Apply Pattern
                </button>
              </div>
            </div>

            {/* AI Flow Generator */}
            <div className="bg-[#1a2235] rounded-3xl border border-slate-800 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-[#00e5a0]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">AI Flow Generator</h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
                Automatically design a learning path based on your course materials and student knowledge gaps.
              </p>
              <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-700 group">
                <Sparkles size={16} className="text-[#00e5a0] group-hover:scale-110 transition-transform" />
                Generate Flow
              </button>
            </div>

            {/* Flow Summary */}
            <div className="bg-[#1a2235] rounded-3xl border border-slate-800 p-6 shadow-xl flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Info size={18} className="text-slate-500" />
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Flow Summary</h3>
              </div>
              <div className="bg-[#0f1623] rounded-2xl p-4 border border-slate-800/50">
                <p className="text-xs text-slate-400 leading-relaxed">
                  The current flow implements a <span className="text-white font-bold">Socratic Retry Loop</span>. 
                  Students are presented with a conceptual question about pointers. 
                  Incorrect answers trigger a specific memory address hint before allowing a second attempt. 
                  Success leads to the core syntax lesson.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Total Nodes</span>
                  <span className="text-white">{nodes.length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Decision Points</span>
                  <span className="text-white">1</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Avg. Path Length</span>
                  <span className="text-white">4.2 Steps</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FlowDesignerPage;
