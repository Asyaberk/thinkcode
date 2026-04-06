import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Save,
  Send,
  Upload,
  FileText,
  Video,
  Trash2,
  Edit3,
  Sparkles,
  ChevronDown,
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
  MessageSquare,
  AlertCircle,
  ChevronRight,
  Code,
  Image,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';
import {
  uploadResource,
  processResource,
  pollResult,
  listResources,
  getResourceContent,
  ResourceItem,
  ExtractedContent,
} from '../api/resources';

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

// ─── Flow Builder (değişmedi) ────────────────────────────────────────────────

type NodeType = 'Question' | 'Hint' | 'Show Content' | 'Retry' | 'Evaluate';
interface FlowNode { id: string; type: NodeType; x: number; y: number; label: string; }
interface Connection { from: string; to: string; label?: string; color?: string; }

const INITIAL_NODES: FlowNode[] = [
  { id: '1', type: 'Question',     x: 100, y: 150, label: 'Upload a file to start' },
  { id: '2', type: 'Evaluate',     x: 350, y: 150, label: 'Check Answer' },
  { id: '3', type: 'Hint',         x: 350, y: 300, label: 'Memory Address Hint' },
  { id: '4', type: 'Retry',        x: 100, y: 300, label: 'Try Again' },
  { id: '5', type: 'Show Content', x: 600, y: 150, label: 'Next Topic' },
];
const INITIAL_CONNECTIONS: Connection[] = [
  { from: '1', to: '2' },
  { from: '2', to: '5', label: 'Correct', color: '#10b981' },
  { from: '2', to: '3', label: 'Wrong',   color: '#ef4444' },
  { from: '3', to: '4' },
  { from: '4', to: '1' },
];

// ─── File type icon helper ───────────────────────────────────────────────────
function FileIcon({ type }: { type: string }) {
  if (['png', 'jpg', 'jpeg'].includes(type)) return <Image size={20} />;
  if (['cpp', 'h', 'c', 'py', 'js', 'ts', 'java'].includes(type)) return <Code size={20} />;
  return <FileText size={20} />;
}

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ResourceItem['status'] }) {
  const config = {
    uploaded:   { label: 'Uploaded',   cls: 'bg-slate-700 text-slate-300' },
    processing: { label: 'Processing…', cls: 'bg-amber-500/20 text-amber-400 animate-pulse' },
    done:       { label: 'Done ✓',     cls: 'bg-emerald-500/20 text-emerald-400' },
    failed:     { label: 'Failed',     cls: 'bg-red-500/20 text-red-400' },
  }[status];
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest', config.cls)}>
      {config.label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const ContentBuilderPage: React.FC<ContentBuilderPageProps> = ({
  sections, onDashboardClick, onProblemsClick, onAnalyticsClick,
  onSectionSelect, onInstructorDashboardClick, onContentBuilderClick,
  onLogout, userRole,
}) => {
  // ── Upload state ──────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [weekName, setWeekName]     = useState('');
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resources state ──────────────────────────────────────────────────────
  const [resources, setResources]           = useState<ResourceItem[]>([]);
  const [processingIds, setProcessingIds]   = useState<Set<string>>(new Set());
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  // ── Extracted content state ───────────────────────────────────────────────
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [activeTab, setActiveTab] = useState<'Topics' | 'Lessons' | 'Questions' | 'Misconceptions'>('Topics');

  // ── Flow builder state ───────────────────────────────────────────────────
  const [nodes, setNodes]       = useState<FlowNode[]>(INITIAL_NODES);
  const [connections]           = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // ─── Load resources on mount ──────────────────────────────────────────────
  useEffect(() => {
    listResources()
      .then(setResources)
      .catch(() => {}); // Not authenticated yet → silently ignore
  }, []);

  // ─── Poll processing resources ────────────────────────────────────────────
  useEffect(() => {
    if (processingIds.size === 0) return;

    const interval = setInterval(async () => {
      for (const id of processingIds) {
        try {
          const result = await pollResult(id);
          if (result.status === 'done' || result.status === 'failed') {
            setResources(prev =>
              prev.map(r => r.resource_id === id
                ? { ...r, status: result.status as any, error_message: result.error_message }
                : r
              )
            );
            setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s; });

            // Auto-load content of the first done resource
            if (result.status === 'done' && !selectedResource) {
              setSelectedResource(id);
              loadContent(id);
            }
          }
        } catch {}
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [processingIds, selectedResource]);

  // ─── Drag-and-drop handlers ───────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFilesSelected(files);
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFilesSelected(Array.from(e.target.files));
  };

  // ─── Upload logic ─────────────────────────────────────────────────────────
  const handleFilesSelected = async (files: File[]) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      for (const file of files) {
        const result = await uploadResource(file, weekName || undefined);
        const newResource: ResourceItem = {
          resource_id:   result.resource_id,
          filename:      result.filename,
          file_type:     file.name.split('.').pop()?.toLowerCase() || 'file',
          week_name:     weekName || null,
          status:        'uploaded',
          error_message: null,
          created_at:    new Date().toISOString(),
        };
        setResources(prev => [newResource, ...prev]);
      }
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Process resources ─────────────────────────────────────────────────────
  const handleProcessResources = async () => {
    const toProcess = resources.filter(r => r.status === 'uploaded');
    if (!toProcess.length) return;

    for (const r of toProcess) {
      try {
        await processResource(r.resource_id);
        setResources(prev => prev.map(res =>
          res.resource_id === r.resource_id ? { ...res, status: 'processing' } : res
        ));
        setProcessingIds(prev => new Set([...prev, r.resource_id]));
      } catch (e: any) {
        setResources(prev => prev.map(res =>
          res.resource_id === r.resource_id
            ? { ...res, status: 'failed', error_message: e.message }
            : res
        ));
      }
    }
  };

  // ─── Load extracted content ───────────────────────────────────────────────
  const loadContent = useCallback(async (resourceId: string) => {
    try {
      const content = await getResourceContent(resourceId);
      setExtractedContent(content);
      setSelectedResource(resourceId);
    } catch {}
  }, []);

  // ─── Remove resource from list (UI only) ─────────────────────────────────
  const removeResource = (id: string) => {
    setResources(prev => prev.filter(r => r.resource_id !== id));
    if (selectedResource === id) { setSelectedResource(null); setExtractedContent(null); }
  };

  // ─── Tab content renderer ─────────────────────────────────────────────────
  const renderTabContent = () => {
    if (!extractedContent) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-3 text-slate-600">
            <Sparkles size={22} />
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Upload a file and click<br />"Process Resources" to generate content
          </p>
        </div>
      );
    }

    if (activeTab === 'Topics') {
      return (
        <div className="space-y-3">
          {extractedContent.topics.map((t, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl group hover:border-emerald-500/30 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-0.5">
                  <Layers size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.description}</p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-[10px] font-bold text-emerald-500">{t.lessons.length} lessons</span>
                    <span className="text-[10px] font-bold text-blue-400">{t.questions.length} questions</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {extractedContent.topics.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No topics extracted yet.</p>
          )}
        </div>
      );
    }

    if (activeTab === 'Lessons') {
      const allLessons = extractedContent.topics.flatMap(t =>
        t.lessons.map(l => ({ ...l, topicName: t.name }))
      );
      return (
        <div className="space-y-3">
          {allLessons.map((l, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl group hover:border-emerald-500/30 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{l.topicName}</p>
                  <p className="text-sm font-bold text-slate-200">{l.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l.summary}</p>
                  <p className="text-[10px] text-slate-600 mt-1">~{l.estimated_minutes} min · {l.content_markdown.length} chars</p>
                </div>
              </div>
            </motion.div>
          ))}
          {allLessons.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No lessons extracted yet.</p>
          )}
        </div>
      );
    }

    if (activeTab === 'Questions') {
      const allQuestions = extractedContent.topics.flatMap(t =>
        t.questions.map(q => ({ ...q, topicName: t.name }))
      );
      return (
        <div className="space-y-3">
          {allQuestions.map((q, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl group hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5">
                  <HelpCircle size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{q.topicName}</p>
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                      q.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-500' :
                      q.difficulty === 'hard' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    )}>{q.difficulty}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-200">{q.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{q.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
          {allQuestions.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No questions extracted yet.</p>
          )}
        </div>
      );
    }

    if (activeTab === 'Misconceptions') {
      return (
        <div className="space-y-3">
          {extractedContent.misconceptions.map((m, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-slate-900/40 border border-red-500/10 p-4 rounded-2xl flex items-start gap-3"
            >
              <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 flex-shrink-0">
                <Zap size={16} />
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{m}</p>
            </motion.div>
          ))}
          {extractedContent.misconceptions.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No misconceptions identified.</p>
          )}
        </div>
      );
    }
  };

  const uploadedCount   = resources.filter(r => r.status === 'uploaded').length;
  const processingCount = resources.filter(r => r.status === 'processing').length;
  const doneCount       = resources.filter(r => r.status === 'done').length;

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

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Content & Learning Flow Builder</h1>
              <p className="text-slate-400 text-lg font-medium">Upload materials → AI extracts topics, lessons & questions → Students learn</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-slate-700">
                <Save size={18} /> Save Draft
              </button>
              <button className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                <Send size={18} /> Publish
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* ── Left Column ── */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Resource Upload */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileUp size={20} className="text-emerald-500" /> Resources
                  </h2>
                  {resources.length > 0 && (
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest">
                      {doneCount > 0 && <span className="text-emerald-500">{doneCount} done</span>}
                      {processingCount > 0 && <span className="text-amber-400 animate-pulse">{processingCount} processing</span>}
                      {uploadedCount > 0 && <span className="text-slate-500">{uploadedCount} ready</span>}
                    </div>
                  )}
                </div>

                {/* Week Name Input */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                    Week Label (optional)
                  </label>
                  <input
                    type="text"
                    value={weekName}
                    onChange={e => setWeekName(e.target.value)}
                    placeholder="e.g. Week 1: Preprocessors"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {/* Drag-and-drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-3xl p-8 text-center transition-all group cursor-pointer bg-slate-900/20',
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-800 hover:border-emerald-500/50',
                    isUploading && 'opacity-60 pointer-events-none'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.cpp,.h,.c,.py,.txt,.md,.js,.ts,.java"
                    multiple
                    onChange={handleFileInput}
                  />
                  <div className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors',
                    isDragging ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-500 group-hover:text-emerald-500'
                  )}>
                    {isUploading ? <RefreshCw size={32} className="animate-spin" /> : <Upload size={32} />}
                  </div>
                  <p className="text-sm font-bold text-white mb-1">
                    {isUploading ? 'Uploading…' : isDragging ? 'Drop to upload!' : 'Drop files or click to upload'}
                  </p>
                  <p className="text-xs text-slate-500">PDF · Images · C++ · Python · Text</p>
                </div>

                {/* Error message */}
                {uploadError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                    <AlertCircle size={14} />
                    {uploadError}
                  </div>
                )}

                {/* File list */}
                {resources.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {resources.map(r => (
                      <motion.div
                        key={r.resource_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          'bg-slate-800/30 border p-3 rounded-xl flex items-center justify-between group cursor-pointer transition-all',
                          selectedResource === r.resource_id
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : 'border-slate-800 hover:border-slate-700'
                        )}
                        onClick={() => r.status === 'done' && loadContent(r.resource_id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-emerald-500 flex-shrink-0">
                            <FileIcon type={r.file_type} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-200 truncate">{r.filename}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <StatusBadge status={r.status} />
                              {r.week_name && (
                                <span className="text-[10px] text-slate-600 font-medium">{r.week_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeResource(r.resource_id); }}
                          className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Process button */}
                <button
                  onClick={handleProcessResources}
                  disabled={uploadedCount === 0 || processingCount > 0}
                  className={cn(
                    'w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                    uploadedCount > 0 && processingCount === 0
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  )}
                >
                  {processingCount > 0 ? (
                    <><RefreshCw size={18} className="animate-spin" /> Processing {processingCount} file{processingCount > 1 ? 's' : ''}…</>
                  ) : (
                    <><Sparkles size={18} /> Process {uploadedCount > 0 ? `${uploadedCount} File${uploadedCount > 1 ? 's' : ''}` : 'Resources'}</>
                  )}
                </button>
              </section>

              {/* AI Content Panel */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles size={20} className="text-emerald-500" /> AI Content
                  </h2>
                  {extractedContent && (
                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                      {extractedContent.topics.length} topics
                    </span>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-950 rounded-xl">
                  {(['Topics', 'Lessons', 'Questions', 'Misconceptions'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
                        activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                  {renderTabContent()}
                </div>

                {/* Stats row */}
                {extractedContent && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                    {[
                      { label: 'Topics',    value: extractedContent.topics.length,    color: 'text-emerald-500' },
                      { label: 'Lessons',   value: extractedContent.topics.flatMap(t => t.lessons).length,   color: 'text-blue-400' },
                      { label: 'Questions', value: extractedContent.topics.flatMap(t => t.questions).length, color: 'text-purple-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-900/60 rounded-xl p-3 text-center">
                        <p className={cn('text-xl font-bold', color)}>{value}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ── Right Column: Flow Builder ── */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 h-[800px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 z-10">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <GitBranch size={20} className="text-emerald-500" /> Learning Flow Builder
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Design the student journey logic</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"><MousePointer2 size={18} /></button>
                    <button className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"><Layers size={18} /></button>
                    <button className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"><Settings size={18} /></button>
                  </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 bg-slate-950/50 rounded-3xl border border-slate-800 relative overflow-hidden cursor-crosshair">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                  {/* SVG Connections */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#334155" />
                      </marker>
                    </defs>
                    {connections.map((conn, idx) => {
                      const fromNode = nodes.find(n => n.id === conn.from);
                      const toNode   = nodes.find(n => n.id === conn.to);
                      if (!fromNode || !toNode) return null;
                      const startX = fromNode.x + 160, startY = fromNode.y + 40;
                      const endX   = toNode.x,         endY   = toNode.y + 40;
                      return (
                        <g key={idx}>
                          <path
                            d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`}
                            stroke={conn.color || '#334155'} strokeWidth="2" fill="none"
                            markerEnd="url(#arrowhead)" className="transition-all duration-500"
                          />
                          {conn.label && (
                            <foreignObject x={(startX + endX) / 2 - 40} y={(startY + endY) / 2 - 10} width="80" height="20">
                              <div className="flex justify-center">
                                <span className={cn(
                                  'text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
                                  conn.label === 'Correct'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                                )}>{conn.label}</span>
                              </div>
                            </foreignObject>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Draggable Nodes */}
                  {nodes.map(node => (
                    <motion.div
                      key={node.id}
                      drag dragMomentum={false}
                      onDrag={(_, info) => setNodes(prev => prev.map(n =>
                        n.id === node.id ? { ...n, x: n.x + info.delta.x, y: n.y + info.delta.y } : n
                      ))}
                      onClick={() => setSelectedNode(node.id)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        'absolute w-40 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl cursor-grab active:cursor-grabbing transition-all',
                        selectedNode === node.id ? 'ring-2 ring-emerald-500 border-emerald-500/50' : 'hover:border-slate-700'
                      )}
                      style={{ left: node.x, top: node.y }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center',
                          node.type === 'Question'     && 'bg-blue-500/10 text-blue-500',
                          node.type === 'Evaluate'     && 'bg-purple-500/10 text-purple-500',
                          node.type === 'Hint'         && 'bg-amber-500/10 text-amber-500',
                          node.type === 'Retry'        && 'bg-red-500/10 text-red-500',
                          node.type === 'Show Content' && 'bg-emerald-500/10 text-emerald-500',
                        )}>
                          {node.type === 'Question'     && <HelpCircle size={14} />}
                          {node.type === 'Evaluate'     && <CheckCircle2 size={14} />}
                          {node.type === 'Hint'         && <Lightbulb size={14} />}
                          {node.type === 'Retry'        && <RefreshCw size={14} />}
                          {node.type === 'Show Content' && <Play size={14} />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{node.type}</span>
                      </div>
                      <p className="text-xs font-bold text-white leading-tight">{node.label}</p>
                    </motion.div>
                  ))}

                  {/* Node Toolbar */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2 flex gap-2 shadow-2xl z-20">
                    {(['Question', 'Hint', 'Show Content', 'Retry', 'Evaluate'] as NodeType[]).map(type => (
                      <button key={type} className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 transition-all group relative">
                        {type === 'Question'     && <HelpCircle size={20} />}
                        {type === 'Hint'         && <Lightbulb size={20} />}
                        {type === 'Show Content' && <Play size={20} />}
                        {type === 'Retry'        && <RefreshCw size={20} />}
                        {type === 'Evaluate'     && <CheckCircle2 size={20} />}
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Add {type}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Flow Patterns card */}
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
                      Apply Pattern <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                {/* AI Flow Generator */}
                <div className="mt-6 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex items-center justify-between group">
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

              {/* Flow Explanation */}
              <section className="bg-slate-900/50 border border-slate-800 rounded-[32px] p-8 flex gap-8">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={20} className="text-emerald-500" />
                    <h2 className="text-xl font-bold text-white">Flow Explanation</h2>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl">
                    <p className="text-slate-400 leading-relaxed italic font-serif">
                      {extractedContent
                        ? `This course covers ${extractedContent.topics.length} topics extracted from the uploaded material. Students will study ${extractedContent.topics.flatMap(t => t.lessons).length} lessons and answer ${extractedContent.topics.flatMap(t => t.questions).length} questions. The flow evaluates student answers, provides Socratic hints on wrong answers, and progresses through topics as mastery is achieved.`
                        : '"Upload your lecture materials and click Process Resources. AI will extract topics, generate lessons with full explanations, and create practice questions — students will see this content immediately."'
                      }
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
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Content Status</p>
                      <p className="text-xs font-medium text-slate-300">
                        {doneCount > 0 ? `${doneCount} file processed` : 'No files processed yet'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Est. Study Time</p>
                      <p className="text-xs font-medium text-slate-300">
                        {extractedContent
                          ? `${extractedContent.topics.flatMap(t => t.lessons).reduce((s, l) => s + l.estimated_minutes, 0)} min total`
                          : '—'}
                      </p>
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
