import React, { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'motion/react';

import { 

  Plus, Save, Send, Upload, FileText, Video, Trash2, Edit3,

  Sparkles, Layers, RefreshCw, ArrowRight, FileAudio, Check,

  AlertCircle, Loader2, X, BookOpen, HelpCircle, CheckCircle2,

  Circle, Clock, Link, Globe, ExternalLink, MessageSquare, Bot,

  GitBranch, ChevronDown, ChevronRight, BookMarked,

} from 'lucide-react';

import { Sidebar } from '../components/Sidebar';

import { Section, UserRole } from '../types';

import { cn } from '../lib/utils';

import {

  uploadResource, processResource, listResources, pollResult,

  addResourceLink,

  listTopics, getTopicLessons, getTopicProblems,

  updateTopic, deleteTopic,

  updateLesson, deleteLesson,

  updateProblem, deleteProblem,

  createTopic, createLesson, createProblem,

  sendContentChat, getResourceTopics,

  ResourceItem, DbTopic, DbLesson, DbProblem, ContentChatResponse, ResourceTopic,

} from '../api/resources';

interface CourseBuilderPageProps {

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
  /** Amber badge count for pending enrollment requests. */
  pendingEnrollmentsCount?: number;
  /** Analytics sub-view — passed through so Class Analytics dropdown works from any page */
  activeAnalyticsView?: string;
  onAnalyticsViewChange?: (view: string) => void;
}

type Tab = 'Topics' | 'Lessons' | 'Questions' | 'AI Chat';

// ─────────────────────────────────────────────────────────────────────────────

// EDIT MODAL

// ─────────────────────────────────────────────────────────────────────────────

interface EditTopicModalProps {

  topic: DbTopic;

  onClose: () => void;

  onSaved: (updated: DbTopic) => void;

}

const EditTopicModal: React.FC<EditTopicModalProps> = ({ topic, onClose, onSaved }) => {

  const [name, setName] = useState(topic.name);

  const [desc, setDesc] = useState(topic.description || '');

  const [saving, setSaving] = useState(false);

  const save = async () => {

    setSaving(true);

    try {

      const updated = await updateTopic(topic.id, { name, description: desc });

      onSaved(updated);

      onClose();

    } catch { setSaving(false); }

  };

  return (

    <Modal title="Edit Topic" onClose={onClose}>

      <Field label="Topic Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>

      <Field label="Description"><textarea className={`${inputCls} resize-none`} rows={4} value={desc} onChange={e => setDesc(e.target.value)} /></Field>

      <ModalFooter saving={saving} onClose={onClose} onSave={save} />

    </Modal>

  );

};

interface EditLessonModalProps {

  lesson: DbLesson;

  onClose: () => void;

  onSaved: (updated: DbLesson) => void;

}

const EditLessonModal: React.FC<EditLessonModalProps> = ({ lesson, onClose, onSaved }) => {

  const [title, setTitle] = useState(lesson.title);

  const [summary, setSummary] = useState(lesson.summary || '');

  const [content, setContent] = useState(lesson.content_markdown || '');

  const [minutes, setMinutes] = useState(String(lesson.estimated_minutes || 15));

  const [saving, setSaving] = useState(false);

  const save = async () => {

    setSaving(true);

    try {

      const updated = await updateLesson(lesson.id, {

        title, summary,

        content_markdown: content,

        estimated_minutes: parseInt(minutes) || 15,

      });

      onSaved(updated);

      onClose();

    } catch { setSaving(false); }

  };

  return (

    <Modal title="Edit Lesson" wide onClose={onClose}>

      <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} /></Field>

      <Field label="Summary"><textarea className={`${inputCls} resize-none`} rows={2} value={summary} onChange={e => setSummary(e.target.value)} /></Field>

      <Field label="Content (Markdown)">

        <textarea

          className={`${inputCls} resize-none font-mono text-[11px]`}

          rows={14}

          value={content}

          onChange={e => setContent(e.target.value)}

          placeholder="## Lesson Title&#10;&#10;### Introduction&#10;..."

        />

      </Field>

      <Field label="Est. minutes"><input className={inputCls} type="number" value={minutes} onChange={e => setMinutes(e.target.value)} style={{width:'80px'}} /></Field>

      <ModalFooter saving={saving} onClose={onClose} onSave={save} />

    </Modal>

  );

};

interface EditProblemModalProps {

  problem: DbProblem;

  onClose: () => void;

  onSaved: (updated: DbProblem) => void;

}

const EditProblemModal: React.FC<EditProblemModalProps> = ({ problem, onClose, onSaved }) => {

  const [title, setTitle] = useState(problem.title);

  const [description, setDescription] = useState(problem.description);

  const [difficulty, setDifficulty] = useState(problem.difficulty);

  const [correctAnswer, setCorrectAnswer] = useState(problem.correct_answer || '');

  const [options, setOptions] = useState(

    (problem.options || []).map(o => ({ ...o }))

  );

  const [saving, setSaving] = useState(false);

  const setOption = (idx: number, text: string) =>

    setOptions(prev => prev.map((o, i) => i === idx ? { ...o, text } : o));

  const toggleCorrect = (idx: number) =>

    setOptions(prev => prev.map((o, i) => ({ ...o, is_correct: i === idx })));

  const save = async () => {

    setSaving(true);

    try {

      const updated = await updateProblem(problem.id, {

        title, description, difficulty: difficulty as any,

        correct_answer: correctAnswer,

        options: options.map(o => ({ id: o.id, text: o.text, is_correct: o.is_correct })),

      });

      onSaved(updated);

      onClose();

    } catch { setSaving(false); }

  };

  return (

    <Modal title="Edit Question" wide onClose={onClose}>

      <Field label="Title"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} /></Field>

      <Field label="Question Text (use ___ for blank)">

        <textarea className={`${inputCls} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} />

      </Field>

      <div className="flex gap-4">

        <Field label="Difficulty">

          <select className={inputCls} value={difficulty} onChange={e => setDifficulty(e.target.value)}>

            <option value="easy">Easy</option>

            <option value="medium">Medium</option>

            <option value="hard">Hard</option>

          </select>

        </Field>

        <Field label="Correct Answer (text)">

          <input className={inputCls} value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} placeholder="e.g. preprocessor" />

        </Field>

      </div>

      {options.length > 0 && (

        <Field label="Answer Options (click radio to mark correct)">

          <div className="space-y-2">

            {options.map((opt, idx) => (

              <div key={idx} className="flex items-center gap-2">

                <button

                  onClick={() => toggleCorrect(idx)}

                  className={cn(

                    'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',

                    opt.is_correct ? 'border-[#00e5a0] bg-[#00e5a0]/20' : 'border-slate-700'

                  )}

                >

                  {opt.is_correct && <div className="w-2 h-2 rounded-full bg-[#00e5a0]" />}

                </button>

                <input

                  className={`${inputCls} flex-1`}

                  value={opt.text}

                  onChange={e => setOption(idx, e.target.value)}

                  placeholder={`Option ${idx + 1}`}

                />

              </div>

            ))}

          </div>

        </Field>

      )}

      <ModalFooter saving={saving} onClose={onClose} onSave={save} />

    </Modal>

  );

};

// ─────────────────────────────────────────────────────────────────────────────

// ADD MODAL

// ─────────────────────────────────────────────────────────────────────────────

interface AddModalProps {

  tab: Tab;

  topics: DbTopic[];

  classId: string;

  onClose: () => void;

  onSaved: () => void;

}

const AddModal: React.FC<AddModalProps> = ({ tab, topics, classId, onClose, onSaved }) => {

  const [topicId, setTopicId] = useState(topics[0]?.id || '');

  const [title, setTitle] = useState('');

  const [desc, setDesc] = useState('');

  const [difficulty, setDifficulty] = useState('medium');

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');

  const save = async () => {

    if (!title.trim()) { setError('Title is required.'); return; }

    setSaving(true); setError('');

    try {

      if (tab === 'Topics') {

        await createTopic({ name: title.trim(), description: desc.trim() || undefined, class_id: classId || undefined });

      } else if (tab === 'Lessons') {

        if (!topicId) { setError('Select a topic.'); setSaving(false); return; }

        await createLesson(topicId, { title: title.trim(), summary: desc.trim() || undefined });

      } else {

        if (!topicId) { setError('Select a topic.'); setSaving(false); return; }

        await createProblem(topicId, {

          title: title.trim(),

          description: desc.trim() || title.trim(),

          type: 'multiple_choice',

          difficulty,

        });

      }

      onSaved(); onClose();

    } catch (e: any) { setError(e.message || 'Save failed'); setSaving(false); }

  };

  return (

    <Modal title={`Add ${tab.slice(0, -1)}`} onClose={onClose}>

      {tab !== 'Topics' && (

        <Field label="Topic">

          <select className={inputCls} value={topicId} onChange={e => setTopicId(e.target.value)}>

            <option value="">— select —</option>

            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}

          </select>

        </Field>

      )}

      <Field label={tab === 'Topics' ? 'Topic Name' : tab === 'Lessons' ? 'Lesson Title' : 'Question Title'}>

        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} />

      </Field>

      <Field label={tab === 'Topics' ? 'Description' : tab === 'Lessons' ? 'Summary' : 'Question Text (use ___ for blank)'}>

        <textarea className={`${inputCls} resize-none`} rows={3} value={desc} onChange={e => setDesc(e.target.value)} />

      </Field>

      {tab === 'Questions' && (

        <Field label="Difficulty">

          <select className={inputCls} value={difficulty} onChange={e => setDifficulty(e.target.value)}>

            <option value="easy">Easy</option>

            <option value="medium">Medium</option>

            <option value="hard">Hard</option>

          </select>

        </Field>

      )}

      {error && <p className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

      <ModalFooter saving={saving} onClose={onClose} onSave={save} />

    </Modal>

  );

};

// ─────────────────────────────────────────────────────────────────────────────

// Shared mini-components

// ─────────────────────────────────────────────────────────────────────────────

const inputCls =

  'w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-[#00e5a0] transition-all placeholder:text-slate-600 appearance-none';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (

  <div className="space-y-1.5">

    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{label}</label>

    {children}

  </div>

);

const Modal: React.FC<{ title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }> = ({ title, wide, onClose, children }) => (

  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>

    <motion.div

      initial={{ opacity: 0, scale: 0.95, y: 10 }}

      animate={{ opacity: 1, scale: 1, y: 0 }}

      className={cn('bg-[#1a2235] border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-4', wide ? 'w-[640px] max-h-[90vh] overflow-y-auto' : 'w-[440px]')}

      onClick={e => e.stopPropagation()}

    >

      <div className="flex justify-between items-center">

        <h3 className="text-sm font-bold text-white">{title}</h3>

        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>

      </div>

      {children}

    </motion.div>

  </div>

);

const ModalFooter: React.FC<{ saving: boolean; onClose: () => void; onSave: () => void }> = ({ saving, onClose, onSave }) => (

  <div className="flex justify-end gap-2 pt-2">

    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white">Cancel</button>

    <button

      onClick={onSave}

      disabled={saving}

      className="px-4 py-2 bg-[#00e5a0] text-slate-950 rounded-xl text-xs font-bold disabled:opacity-60 flex items-center gap-1.5"

    >

      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save

    </button>

  </div>

);

// ─────────────────────────────────────────────────────────────────────────────

// CONTENT CARDS

// ─────────────────────────────────────────────────────────────────────────────

const TopicCard: React.FC<{ topic: DbTopic; onEdit: () => void; onDelete: () => void }> = ({ topic, onEdit, onDelete }) => (

  <div className="bg-[#0f1623] border border-slate-800 p-5 rounded-xl group hover:border-[#00e5a0]/30 transition-all">

    <div className="flex justify-between items-start">

      <div className="flex-1 min-w-0">

        <h3 className="text-sm font-bold text-white group-hover:text-[#00e5a0] transition-colors">{topic.name}</h3>

        {topic.description && <p className="text-xs text-slate-500 leading-relaxed mt-1.5">{topic.description}</p>}

      </div>

      <CardActions onEdit={onEdit} onDelete={onDelete} />

    </div>

  </div>

);

const LessonCard: React.FC<{ lesson: DbLesson; onEdit: () => void; onDelete: () => void }> = ({ lesson, onEdit, onDelete }) => (

  <div className="bg-[#0f1623] border border-slate-800 p-5 rounded-xl group hover:border-[#00e5a0]/30 transition-all">

    <div className="flex justify-between items-start">

      <div className="flex-1 min-w-0">

        <div className="flex items-center gap-2 mb-1.5">

          <BookOpen size={14} className="text-slate-500 shrink-0" />

          <h3 className="text-sm font-bold text-white group-hover:text-[#00e5a0] transition-colors">{lesson.title}</h3>

          {lesson.estimated_minutes && (

            <span className="ml-auto text-[10px] text-slate-600 flex items-center gap-0.5 shrink-0">

              <Clock size={10} /> {lesson.estimated_minutes}m

            </span>

          )}

        </div>

        {lesson.summary && <p className="text-xs text-slate-500 leading-relaxed mb-2">{lesson.summary}</p>}

        {lesson.content_markdown && (

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50 mt-2">

            <p className="text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4">

              {lesson.content_markdown.slice(0, 400)}{lesson.content_markdown.length > 400 ? '…' : ''}

            </p>

          </div>

        )}

      </div>

      <CardActions onEdit={onEdit} onDelete={onDelete} />

    </div>

  </div>

);

const ProblemCard: React.FC<{ problem: DbProblem; onEdit: () => void; onDelete: () => void }> = ({ problem, onEdit, onDelete }) => (

  <div className="bg-[#0f1623] border border-slate-800 p-5 rounded-xl group hover:border-[#00e5a0]/30 transition-all">

    <div className="flex justify-between items-start">

      <div className="flex-1 min-w-0">

        <div className="flex items-center gap-2 mb-1">

          <HelpCircle size={13} className="text-slate-500 shrink-0" />

          <h3 className="text-xs font-bold text-white group-hover:text-[#00e5a0] transition-colors">{problem.title}</h3>

          <span className={cn(

            'ml-auto text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0',

            problem.difficulty === 'easy' && 'bg-emerald-500/10 text-emerald-400',

            problem.difficulty === 'medium' && 'bg-amber-500/10 text-amber-400',

            problem.difficulty === 'hard' && 'bg-red-500/10 text-red-400',

          )}>{problem.difficulty}</span>

        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{problem.description}</p>

        {/* MCQ Options */}

        {(problem.options || []).length > 0 && (

          <div className="space-y-1.5 mt-2">

            {(problem.options || []).map((opt, i) => (

              <div key={opt.id || i} className={cn(

                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] border',

                opt.is_correct

                  ? 'bg-[#00e5a0]/8 border-[#00e5a0]/20 text-[#00e5a0]'

                  : 'bg-slate-900/40 border-slate-800/40 text-slate-500'

              )}>

                {opt.is_correct

                  ? <CheckCircle2 size={11} className="shrink-0" />

                  : <Circle size={11} className="shrink-0" />}

                {opt.text}

              </div>

            ))}

          </div>

        )}

        {problem.correct_answer && (problem.options || []).length === 0 && (

          <div className="mt-2 text-[10px] text-[#00e5a0] bg-[#00e5a0]/8 px-3 py-1.5 rounded-lg border border-[#00e5a0]/15">

            ✓ Correct: {problem.correct_answer}

          </div>

        )}

      </div>

      <CardActions onEdit={onEdit} onDelete={onDelete} />

    </div>

  </div>

);

const CardActions: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({ onEdit, onDelete }) => (

  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0">

    <button onClick={onEdit} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">

      <Edit3 size={12} />

    </button>

    <button onClick={onDelete} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-colors">

      <Trash2 size={12} />

    </button>

  </div>

);

// ─────────────────────────────────────────────────────────────────────────────

// MAIN PAGE

// ─────────────────────────────────────────────────────────────────────────────

export const CourseBuilderPage: React.FC<CourseBuilderPageProps> = ({

  sections, onDashboardClick, onProblemsClick, onAnalyticsClick,

  onFlowDesignerClick,

  onSectionSelect, onInstructorDashboardClick, onCourseBuilderClick,

  onEnrollmentManagementClick, onLogout, onSwitchCourse,

  courseName, userRole, activeCourseId, pendingEnrollmentsCount = 0,

  activeAnalyticsView, onAnalyticsViewChange,

}) => {

  const [activeTab, setActiveTab] = useState<Tab>('Topics');

  const [isRegenerating, setIsRegenerating] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);

  const [weekName, setWeekName] = useState('');

  const [selectedClassId, setSelectedClassId] = useState<string>(activeCourseId || '');

  const [availableClasses] = useState<{id: string; code: string; name: string}[]>([]);

  useEffect(() => {

    if (activeCourseId) setSelectedClassId(activeCourseId);

  }, [activeCourseId]);

  // Modal states

  const [editingTopic, setEditingTopic] = useState<DbTopic | null>(null);

  const [editingLesson, setEditingLesson] = useState<DbLesson | null>(null);

  const [editingProblem, setEditingProblem] = useState<DbProblem | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);

  // Files

  const [files, setFiles] = useState<ResourceItem[]>([]);

  const [uploading, setUploading] = useState(false);

  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Link sekmesi state

  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');

  const [linkUrl, setLinkUrl] = useState('');

  const [linkTitle, setLinkTitle] = useState('');

  const [linkType, setLinkType] = useState<'link' | 'video' | 'pdf'>('link');

  const [linkWeekName, setLinkWeekName] = useState('');

  const [linkAdding, setLinkAdding] = useState(false);

  const [linkError, setLinkError] = useState('');

  const [linkSuccess, setLinkSuccess] = useState('');

  // Instructor custom prompt & AI chat

  const [instructorPrompt, setInstructorPrompt] = useState('');

  const [showPromptBox, setShowPromptBox] = useState(false);

  type ChatMsg = { role: 'user' | 'assistant'; content: string; loading?: boolean; warnings?: string[] };

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const [chatInput, setChatInput] = useState('');

  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resource topic expand
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [resourceTopicsCache, setResourceTopicsCache] = useState<Record<string, ResourceTopic[]>>({});
  const [resourceTopicsLoading, setResourceTopicsLoading] = useState<string | null>(null);

  // Content

  const [topics, setTopics] = useState<DbTopic[]>([]);

  const [lessons, setLessons] = useState<DbLesson[]>([]);

  const [problems, setProblems] = useState<DbProblem[]>([]);

  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {

    loadFiles();

    loadAllContent();

    return () => { Object.values(pollingRefs.current).forEach(clearInterval); };

  }, [selectedClassId]);

  const loadFiles = async () => {

    try {

      const data = await listResources(selectedClassId || undefined);

      setFiles(data);

      data.filter(r => r.status === 'processing').forEach(r => startPolling(r.resource_id));

    } catch { /* ignore */ }

  };

  const loadAllContent = async () => {

    setContentLoading(true);

    try {

      const dbTopics = await listTopics(selectedClassId || undefined);

      setTopics(dbTopics);

      if (dbTopics.length > 0) {

        const allLessons: DbLesson[] = [];

        const allProblems: DbProblem[] = [];

        await Promise.all(dbTopics.map(async t => {

          try {

            const [ls, ps] = await Promise.all([getTopicLessons(t.id), getTopicProblems(t.id)]);

            allLessons.push(...ls);

            allProblems.push(...ps);

          } catch { /* ignore */ }

        }));

        setLessons(allLessons);

        setProblems(allProblems);

      } else {

        setLessons([]); setProblems([]);

      }

    } catch { /* ignore */ }

    setContentLoading(false);

  };

  // ── Upload ───────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    if (!weekName.trim()) {
      setUploadError('Please enter a Module Label before uploading.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true); setUploadError('');

    try {

      const result = await uploadResource(file, weekName.trim() || undefined, selectedClassId || undefined);

      setFiles(prev => [{

        resource_id: result.resource_id, filename: file.name,

        file_type: file.name.split('.').pop() || 'pdf',

        week_name: weekName.trim() || null, status: 'uploaded',

        error_message: null,

        source_url: null,

        has_file: true,

        download_url: `/resources/${result.resource_id}/download`,

        created_at: new Date().toISOString(),

      }, ...prev]);

      // NOT auto-processing — instructor clicks "Extract Content" manually

    } catch (err: any) { setUploadError(err.message || 'Upload failed'); }

    setUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';

  };

  const handleAddLink = async () => {

    if (!linkUrl.trim() || !linkTitle.trim()) {

      setLinkError('URL and title are required.');

      return;

    }

    if (!linkWeekName.trim()) {

      setLinkError('Module Label is required.');

      return;

    }

    setLinkAdding(true); setLinkError(''); setLinkSuccess('');

    try {

      const result = await addResourceLink({

        source_url: linkUrl.trim(),

        title: linkTitle.trim(),

        link_type: linkType,

        week_name: linkWeekName.trim() || undefined,

        class_id: selectedClassId || undefined,

      });

      setFiles(prev => [{

        resource_id: result.resource_id,

        filename: linkTitle.trim(),

        file_type: linkType,

        week_name: linkWeekName.trim() || null,

        status: 'done',

        error_message: null,

        created_at: new Date().toISOString(),

        source_url: result.source_url,

      } as any, ...prev]);

      setLinkSuccess('Link added successfully!');

      setLinkUrl(''); setLinkTitle(''); setLinkWeekName('');

      setTimeout(() => setLinkSuccess(''), 3000);

    } catch (err: any) {

      setLinkError(err.message || 'Link eklenemedi.');

    }

    setLinkAdding(false);

  };

  const startPolling = (resourceId: string) => {

    if (pollingRefs.current[resourceId]) return;

    const interval = setInterval(async () => {

      try {

        const result = await pollResult(resourceId);

        if (result.status === 'done' || result.status === 'failed') {

          clearInterval(pollingRefs.current[resourceId]);

          delete pollingRefs.current[resourceId];

          setFiles(prev => prev.map(f => f.resource_id === resourceId ? { ...f, status: result.status as any } : f));

          if (result.status === 'done') await loadAllContent();

        }

      } catch { /* ignore */ }

    }, 3000);

    pollingRefs.current[resourceId] = interval;

  };

  const handleExtract = async () => {

    const pending = files.filter(f => f.status === 'uploaded');

    if (!pending.length) return;

    setIsExtracting(true);

    for (const f of pending) {

      try {

        await processResource(f.resource_id, selectedClassId || undefined, instructorPrompt || undefined);

        setFiles(prev => prev.map(r => r.resource_id === f.resource_id ? { ...r, status: 'processing' } : r));

        startPolling(f.resource_id);

      } catch { /* ignore */ }

    }

    setIsExtracting(false);

  };

  // ── AI Chat ─────────────────────────────────────────────────────────────────

  const handleChat = async () => {

    const msg = chatInput.trim();

    if (!msg || !selectedClassId) return;

    setChatInput('');

    setChatMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '', loading: true }]);

    setChatLoading(true);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {

      const res = await sendContentChat(msg, selectedClassId);

      setChatMessages(prev => [

        ...prev.slice(0, -1),

        {
          role: 'assistant',
          content: res.summary,
          warnings: res.warnings ?? [],
        },

      ]);

      // Refresh content after AI changes

      await loadAllContent();

    } catch (e: any) {

      setChatMessages(prev => [

        ...prev.slice(0, -1),

        { role: 'assistant', content: `❌ Error: ${e.message}` },

      ]);

    } finally {

      setChatLoading(false);

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    }

  };

  // ── Resource topic expand ────────────────────────────────────────────────

  const handleExpandResource = async (resourceId: string) => {
    if (expandedResourceId === resourceId) {
      setExpandedResourceId(null);
      return;
    }
    setExpandedResourceId(resourceId);
    if (resourceTopicsCache[resourceId]) return; // already cached
    setResourceTopicsLoading(resourceId);
    try {
      const topics = await getResourceTopics(resourceId);
      setResourceTopicsCache(prev => ({ ...prev, [resourceId]: topics }));
    } catch { /* ignore */ } finally {
      setResourceTopicsLoading(null);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDeleteTopic = async (id: string) => {

    if (!confirm('Delete this topic and ALL its lessons & questions?')) return;

    try { await deleteTopic(id); setTopics(prev => prev.filter(t => t.id !== id)); } catch { /* ignore */ }

  };

  const handleDeleteLesson = async (id: string) => {

    if (!confirm('Delete this lesson?')) return;

    try { await deleteLesson(id); setLessons(prev => prev.filter(l => l.id !== id)); } catch { /* ignore */ }

  };

  const handleDeleteProblem = async (id: string) => {

    if (!confirm('Delete this question?')) return;

    try { await deleteProblem(id); setProblems(prev => prev.filter(p => p.id !== id)); } catch { /* ignore */ }

  };

  const processingCount = files.filter(f => f.status === 'processing').length;

  const uploadPendingCount = files.filter(f => f.status === 'uploaded').length;

  const StatusBadge = ({ status, errorMessage }: { status: ResourceItem['status']; errorMessage?: string | null }) => {

    if (status === 'processing') return <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500"><Loader2 size={10} className="animate-spin" /> Processing...</span>;

    if (status === 'done') return <span className="flex items-center gap-1 text-[9px] font-bold text-[#00e5a0]"><Check size={10} /> DONE ✓</span>;

    if (status === 'failed') return (
      <span
        className="flex items-center gap-1 text-[9px] font-bold text-red-500 cursor-help"
        title={errorMessage || 'Extraction failed'}
      >
        <AlertCircle size={10} /> Failed
      </span>
    );

    return <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><Check size={10} /> Uploaded</span>;

  };

  const fileIcon = (type: string) => {

    if (['mp4', 'mov'].includes(type)) return <Video size={16} />;

    if (['mp3', 'wav'].includes(type)) return <FileAudio size={16} />;

    return <FileText size={16} />;

  };

  return (

    <div className="flex min-h-screen bg-[#0f1623] text-slate-200 font-sans">

      {/* Modals */}

      {editingTopic && (

        <EditTopicModal

          topic={editingTopic}

          onClose={() => setEditingTopic(null)}

          onSaved={updated => setTopics(prev => prev.map(t => t.id === updated.id ? updated : t))}

        />

      )}

      {editingLesson && (

        <EditLessonModal

          lesson={editingLesson}

          onClose={() => setEditingLesson(null)}

          onSaved={updated => setLessons(prev => prev.map(l => l.id === updated.id ? updated : l))}

        />

      )}

      {editingProblem && (

        <EditProblemModal

          problem={editingProblem}

          onClose={() => setEditingProblem(null)}

          onSaved={updated => setProblems(prev => prev.map(p => p.id === updated.id ? updated : p))}

        />

      )}

      {showAddModal && (

        <AddModal tab={activeTab} topics={topics} classId={selectedClassId} onClose={() => setShowAddModal(false)} onSaved={loadAllContent} />

      )}

      <Sidebar

        sections={sections} activeSectionId="course-builder"

        onSectionSelect={onSectionSelect} onDashboardClick={onDashboardClick}

        onProblemsClick={onProblemsClick} onAnalyticsClick={onAnalyticsClick}

        onInstructorDashboardClick={onInstructorDashboardClick}

        onCourseBuilderClick={onCourseBuilderClick}

        onFlowDesignerClick={onFlowDesignerClick}

        onEnrollmentManagementClick={onEnrollmentManagementClick}
        pendingEnrollmentsCount={pendingEnrollmentsCount}
        onSwitchCourse={onSwitchCourse}
        activeAnalyticsView={activeAnalyticsView}
        onAnalyticsViewChange={onAnalyticsViewChange}
        onLogout={onLogout} userRole={userRole}
        courseName={courseName}
      />

      <main className="flex-1 ml-72 flex flex-col overflow-y-auto">

        {/* Header */}

        <div className="px-8 py-5 border-b border-slate-800 bg-[#0f1623] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Course Builder</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload PDFs, let AI extract structured content, then refine with chat.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {processingCount > 0 && (
                <span className="flex items-center gap-2 text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Processing {processingCount} file{processingCount > 1 ? 's' : ''}…
                </span>
              )}
              {/* Step banner */}
              <div className="hidden lg:flex items-center gap-2 bg-[#0d1526] border border-slate-800 rounded-2xl px-4 py-2.5">
                {[
                  { icon: <Upload size={12} />, label: 'Upload PDF' },
                  { icon: <Sparkles size={12} />, label: 'Extract' },
                  { icon: <Bot size={12} />, label: 'Refine with AI' },
                ].map((step, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <span className="text-[#00e5a0]">{step.icon}</span>
                      {step.label}
                    </div>
                    {i < 2 && <ChevronRight size={12} className="text-slate-700" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}

        <div className="flex px-6 py-6 gap-6 items-start">

          {/* LEFT: Resources */}

          <section className="w-[38%] flex flex-col min-w-0 sticky top-0 self-start">

            <div className="bg-[#1a2235] rounded-2xl border border-slate-800 p-6 flex flex-col gap-5">

              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#00e5a0]/10 flex items-center justify-center">
                    <Layers size={14} className="text-[#00e5a0]" />
                  </div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Resources</h2>
                </div>
                {files.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">{files.length} file{files.length > 1 ? 's' : ''}</span>
                )}
              </div>

              <div className="flex flex-col gap-4">

                {/* Tab selector */}

                <div className="flex bg-[#0f1623] rounded-xl p-1 shrink-0">

                  <button

                    onClick={() => setUploadTab('file')}

                    className={cn(

                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all',

                      uploadTab === 'file' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'

                    )}

                  >

                    <Upload size={13} /> PDF / Dosya

                  </button>

                  <button

                    onClick={() => setUploadTab('link')}

                    className={cn(

                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all',

                      uploadTab === 'link' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'

                    )}

                  >

                    <Link size={13} /> Link Ekle

                  </button>

                </div>

                {uploadTab === 'file' ? (

                  <>
                    {/* Module Label — ABOVE upload zone */}
                    <div className="shrink-0">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        Module Label <span className="text-rose-400">*</span>
                      </label>
                      <input type="text" value={weekName} onChange={e => { setWeekName(e.target.value); setUploadError(''); }}
                        placeholder="e.g. Week 4 — Pointers & Memory"
                        className={cn(
                          'w-full bg-[#0f1623] border rounded-xl px-4 py-2.5 text-xs text-white focus:ring-1 outline-none transition-all placeholder:text-slate-600',
                          weekName.trim() ? 'border-slate-700 focus:ring-[#00e5a0]' : 'border-rose-500/50 focus:ring-rose-500'
                        )}
                      />
                      {!weekName.trim() && (
                        <p className="text-[9px] text-rose-400/80 mt-1 flex items-center gap-1">
                          <AlertCircle size={9} /> Required before uploading
                        </p>
                      )}
                    </div>

                    {/* Upload drop zone */}
                    <label htmlFor="cb-file-upload" className={cn(
                      'border-2 border-dashed rounded-2xl py-6 text-center block',
                      'hover:border-[#00e5a0]/60 transition-all group cursor-pointer bg-[#0f1623]/60 shrink-0',
                      weekName.trim() ? 'border-slate-700' : 'border-slate-800 opacity-60 pointer-events-none',
                      uploading && 'opacity-60 pointer-events-none'
                    )}>
                      <input id="cb-file-upload" ref={fileInputRef} type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.cpp,.h,.py"
                        className="hidden" onChange={handleFileChange} disabled={uploading} />
                      <div className="w-10 h-10 bg-slate-800 group-hover:bg-[#00e5a0]/10 rounded-xl flex items-center justify-center mx-auto mb-2.5 text-slate-500 group-hover:text-[#00e5a0] transition-all">
                        {uploading ? <Loader2 size={20} className="animate-spin text-[#00e5a0]" /> : <Upload size={20} />}
                      </div>
                      <p className="text-xs font-semibold text-white mb-1">{uploading ? 'Uploading…' : 'Drop file or click to upload'}</p>
                      <p className="text-[10px] text-slate-600">PDF, MD, TXT, PNG, CPP</p>

                    </label>

                    {uploadError && <div className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2 shrink-0">{uploadError}</div>}

                  </>

                ) : (

                  /* Link sekmesi */

                  <div className="space-y-3 shrink-0">

                    <div>

                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">URL *</label>

                      <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}

                        placeholder="https://youtube.com/watch?v=... veya Google Drive linki"

                        className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none transition-all placeholder:text-slate-600"

                      />

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Titlek *</label>

                      <input type="text" value={linkTitle} onChange={e => setLinkTitle(e.target.value)}

                        placeholder="Ders Videosu — Hafta 3"

                        className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none transition-all placeholder:text-slate-600"

                      />

                    </div>

                    <div className="flex gap-2">

                      <div className="flex-1">

                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Type</label>

                        <select value={linkType} onChange={e => setLinkType(e.target.value as any)}

                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none">

                          <option value="link">🔗 Web Linki</option>

                          <option value="video">🎬 Video</option>

                          <option value="pdf">📄 PDF Linki</option>

                        </select>

                      </div>

                      <div className="flex-1">

                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">
                          Module <span className="text-rose-400">*</span>
                        </label>

                        <input type="text" value={linkWeekName} onChange={e => setLinkWeekName(e.target.value)}

                          placeholder="Week 3"

                          className={cn(
                            'w-full bg-[#0f1623] border rounded-xl px-3 py-2.5 text-xs text-white focus:ring-1 outline-none transition-all placeholder:text-slate-600',
                            linkWeekName.trim() ? 'border-slate-800 focus:ring-[#00e5a0]' : 'border-rose-500/60 focus:ring-rose-500'
                          )}

                        />

                      </div>

                    </div>

                    {linkError && <div className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{linkError}</div>}

                    {linkSuccess && <div className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-1"><Check size={12}/>{linkSuccess}</div>}

                    <button onClick={handleAddLink} disabled={linkAdding || !linkUrl.trim() || !linkTitle.trim() || !linkWeekName.trim()}

                      className="w-full py-3 bg-[#00e5a0]/10 hover:bg-[#00e5a0]/20 border border-[#00e5a0]/30 text-[#00e5a0] rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40">

                      {linkAdding ? <><Loader2 size={14} className="animate-spin" />Ekleniyor…</> : <><Globe size={14} />Link Ekle</>}

                    </button>

                  </div>

                )}

                <div className="space-y-3">

                  {files.length === 0 && <p className="text-[11px] text-slate-600 text-center pt-6">No resources yet. Upload a PDF veya link ekle.</p>}

                  {/* Group files by module label */}

                  {(() => {

                    let lastWeek = '__INIT__';

                    return files.map(file => {

                      const showHeader = file.week_name !== lastWeek;

                      lastWeek = file.week_name ?? null as any;

                      const jwtToken = localStorage.getItem('access_token') ?? '';

                      const href = file.has_file && file.download_url

                        ? `${file.download_url}${jwtToken ? `?token=${jwtToken}` : ''}`

                        : file.source_url ?? null;

                      return (

                        <div key={file.resource_id}>

                          {showHeader && file.week_name && (

                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1 pt-2 pb-1">

                              📁 {file.week_name}

                            </p>

                          )}

                          <div className="bg-[#0f1623] border border-slate-800 p-3 rounded-xl flex items-center justify-between group hover:border-slate-700 transition-all">

                            <div className="flex items-center gap-3 overflow-hidden">

                              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 shrink-0">{fileIcon(file.file_type)}</div>

                              <div className="overflow-hidden">

                                <p className="text-xs font-bold text-slate-200 truncate max-w-[140px]">{file.filename}</p>

                                <div className="flex items-center gap-2 mt-0.5">

                                  <StatusBadge status={file.status} errorMessage={file.error_message} />

                                  {!file.week_name && <span className="text-[9px] text-slate-700">no module</span>}

                                </div>

                                {/* Error detail row for failed resources */}
                                {file.status === 'failed' && file.error_message && (
                                  <div className="flex items-start gap-1 mt-1.5 bg-red-500/5 border border-red-500/20 rounded-lg px-2 py-1.5 max-w-[200px]">
                                    <AlertCircle size={9} className="text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-[9px] text-red-400 leading-relaxed">
                                      {file.error_message.length > 80
                                        ? file.error_message.slice(0, 80) + '…'
                                        : file.error_message}
                                    </p>
                                  </div>
                                )}

                              </div>

                            </div>

                            <div className="flex items-center gap-1">

                              {/* Open button — PDF or link */}

                              {href && file.status === 'done' && (

                                <a href={href} target="_blank" rel="noopener noreferrer"

                                  className="p-1.5 text-slate-500 hover:text-[#00e5a0] transition-colors"

                                  title={file.has_file ? 'Open PDF' : 'Open Link'}>

                                  {file.has_file ? <FileText size={13} /> : <ExternalLink size={13} />}

                                </a>

                              )}

                              <button

                                onClick={async () => {

                                  if (!confirm(`"${file.filename || 'Bu dosya'}" silinsin mi?`)) return;

                                  try {

                                    const token = localStorage.getItem('access_token') ?? '';

                                    const res = await fetch(

                                      `/api/v1/resources/${file.resource_id}`,

                                      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }

                                    );

                                    if (res.ok || res.status === 204) {

                                      setFiles(prev => prev.filter(f => f.resource_id !== file.resource_id));

                                    } else {

                                      alert('Delete failed: ' + res.status);

                                    }

                                  } catch {

                                    alert('Connection error — could not delete resource.');

                                  }

                                }}

                                className="p-1.5 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"

                                title="Sil">

                                <Trash2 size={14} />

                              </button>

                            </div>

                          </div>

                          {/* Topic expand panel — only for done resources */}
                          {file.status === 'done' && (
                            <div>
                              <button
                                onClick={() => handleExpandResource(file.resource_id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-[#00e5a0] transition-colors"
                              >
                                {expandedResourceId === file.resource_id
                                  ? <ChevronDown size={11} />
                                  : <ChevronRight size={11} />
                                }
                                {resourceTopicsLoading === file.resource_id
                                  ? 'Loading...'
                                  : expandedResourceId === file.resource_id
                                  ? 'Hide generated content'
                                  : 'Show generated content'
                                }
                              </button>

                              {expandedResourceId === file.resource_id && (
                                <div className="mx-1 mb-2 bg-[#0d1526] border border-slate-800 rounded-xl p-3 space-y-2">
                                  {resourceTopicsLoading === file.resource_id ? (
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                      <Loader2 size={11} className="animate-spin" /> Loading…
                                    </div>
                                  ) : (resourceTopicsCache[file.resource_id] ?? []).length === 0 ? (
                                    <p className="text-[10px] text-slate-600 italic">No topics linked to this resource yet.</p>
                                  ) : (
                                    (resourceTopicsCache[file.resource_id] ?? []).map(t => (
                                      <div key={t.id} className="flex items-start gap-2">
                                        <div className="w-5 h-5 rounded-md bg-[#00e5a0]/10 flex items-center justify-center shrink-0 mt-0.5">
                                          <BookMarked size={10} className="text-[#00e5a0]" />
                                        </div>
                                        <div>
                                          <p className="text-[11px] font-bold text-slate-300">{t.name}</p>
                                          <p className="text-[9px] text-slate-600">
                                            {t.lesson_count} lesson{t.lesson_count !== 1 ? 's' : ''} · {t.problem_count} question{t.problem_count !== 1 ? 's' : ''}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                        </div>

                      );

                    });

                  })()}

                </div>

                {/* Custom Instruction */}

                <div className="shrink-0">

                  <button
                    onClick={() => setShowPromptBox(p => !p)}
                    className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-[#00e5a0] transition-colors mb-2"
                  >
                    <Sparkles size={12} className={showPromptBox ? 'text-[#00e5a0]' : ''} />
                    Custom AI Instructions {showPromptBox ? '▲' : '▼'}
                  </button>

                  {showPromptBox && (
                    <div className="mb-2">
                      <textarea
                        value={instructorPrompt}
                        onChange={e => setInstructorPrompt(e.target.value)}
                        placeholder="e.g. Make explanations concise, add more C++ examples, use formal academic tone..."
                        rows={3}
                        className="w-full bg-[#0f1623] border border-[#00e5a0]/30 rounded-xl px-4 py-3 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none transition-all placeholder:text-slate-600 resize-none"
                      />
                      <p className="text-[9px] text-slate-600 mt-1">These instructions guide the AI when extracting content from your PDFs.</p>
                    </div>
                  )}

                </div>

                <button onClick={handleExtract} disabled={isExtracting || uploadPendingCount === 0}

                  className="w-full py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 shrink-0 relative overflow-hidden"
                  style={{
                    background: (isExtracting || uploadPendingCount === 0) ? '#1e2d3d' : 'linear-gradient(135deg, #00e5a0 0%, #00b8a9 100%)',
                    color: (isExtracting || uploadPendingCount === 0) ? '#4a5568' : '#0a0f1a',
                    boxShadow: (isExtracting || uploadPendingCount === 0) ? 'none' : '0 0 24px rgba(0,229,160,0.25)',
                  }}>

                  {isExtracting

                    ? <><Loader2 size={16} className="animate-spin" /> Sending to AI…</>

                    : <> <Sparkles size={14} /> Extract Content

                        {uploadPendingCount > 0 && <span className="bg-black/20 text-xs font-black px-2 py-0.5 rounded-full">{uploadPendingCount}</span>}

                      </>}

                </button>

              </div>

            </div>

          </section>

          {/* RIGHT: AI Content */}

          <section className="flex-1 flex flex-col">

            <div className="bg-[#1a2235] rounded-2xl border border-slate-800 p-6 flex flex-col gap-5">

              <div className="flex items-center justify-between mb-5 shrink-0">

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#00e5a0]/10 flex items-center justify-center">
                    <Sparkles size={14} className="text-[#00e5a0]" />
                  </div>
                  <h2 className="text-sm font-bold text-white tracking-wide">AI Content</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={async () => { setIsRegenerating(true); await loadAllContent(); setIsRegenerating(false); }}
                    disabled={isRegenerating}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-[#00e5a0] transition-all disabled:opacity-50">
                    {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <button onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00e5a0]/10 hover:bg-[#00e5a0]/20 border border-[#00e5a0]/30 text-[#00e5a0] rounded-lg text-[10px] font-bold transition-all">
                    <Plus size={12} /> Add
                  </button>
                </div>

              </div>

              <div className="flex p-1 bg-[#0f1623] rounded-xl mb-4 shrink-0">

                {(['Topics', 'Lessons', 'Questions', 'AI Chat'] as Tab[]).map(tab => (

                  <button key={tab} onClick={() => setActiveTab(tab)}

                    className={cn('flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1',

                      activeTab === tab && tab === 'AI Chat'
                        ? 'bg-gradient-to-r from-[#00e5a0]/20 to-[#00b8a9]/20 text-[#00e5a0] border border-[#00e5a0]/20'
                        : activeTab === tab
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-300')}>

                    {tab === 'AI Chat' && <Bot size={10} />}

                    {tab === 'AI Chat' ? 'AI' : tab}

                    {tab !== 'AI Chat' && (
                      <span className={cn('ml-1 text-[8px] font-black', activeTab === tab ? 'opacity-80' : 'opacity-40')}>
                        {tab === 'Topics' ? topics.length : tab === 'Lessons' ? lessons.length : problems.length}
                      </span>
                    )}

                  </button>

                ))}

              </div>

              <div className="space-y-4" style={{scrollbarWidth:'thin',scrollbarColor:'#1e2d3d transparent'}}>

                {contentLoading && (

                  <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-slate-500" /></div>

                )}

                {!contentLoading && activeTab === 'Topics' && (

                  <>

                    {topics.length === 0 && <EmptyState tab="topics" />}

                    {topics.map(t => (

                      <TopicCard key={t.id} topic={t}

                        onEdit={() => setEditingTopic(t)}

                        onDelete={() => handleDeleteTopic(t.id)} />

                    ))}

                  </>

                )}

                {!contentLoading && activeTab === 'Lessons' && (

                  <>

                    {lessons.length === 0 && <EmptyState tab="lessons" />}

                    {lessons.map(l => (

                      <LessonCard key={l.id} lesson={l}

                        onEdit={() => setEditingLesson(l)}

                        onDelete={() => handleDeleteLesson(l.id)} />

                    ))}

                  </>

                )}

                {!contentLoading && activeTab === 'Questions' && (

                  <>

                    {problems.length === 0 && <EmptyState tab="questions" />}

                    {problems.map(p => (

                      <ProblemCard key={p.id} problem={p}

                        onEdit={() => setEditingProblem(p)}

                        onDelete={() => handleDeleteProblem(p.id)} />

                    ))}

                  </>

                )}

                {activeTab === 'AI Chat' && (

                  <div className="flex flex-col">

                    {/* Quick action chips */}

                    {chatMessages.length === 0 && (

                      <div className="mb-4">

                        <p className="text-[10px] text-slate-500 mb-3 font-bold uppercase tracking-widest">Quick actions</p>

                        <div className="flex flex-wrap gap-2">

                          {[
                            'Write 3 hard questions about the first topic',
                            'Create a new topic on recursion with a full lesson',
                            'Rewrite the first lesson more concisely',
                            'Add 5 easy multiple-choice questions about sorting',
                          ].map(chip => (
                            <button
                              key={chip}
                              onClick={() => setChatInput(chip)}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 hover:border-[#00e5a0]/40"
                            >
                              {chip}
                            </button>
                          ))}

                        </div>

                      </div>

                    )}

                    {/* Chat messages */}

                    <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1" style={{scrollbarWidth:'thin',scrollbarColor:'#1e2d3d transparent'}}>

                      {chatMessages.map((msg, i) => (

                        <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>

                          {msg.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-full bg-[#00e5a0]/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Bot size={14} className="text-[#00e5a0]" />
                            </div>
                          )}

                          <div className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed',
                            msg.role === 'user'
                              ? 'bg-[#00e5a0]/10 text-white rounded-br-sm'
                              : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                          )}>
                            {msg.loading
                              ? <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin text-[#00e5a0]" /> Thinking…</span>
                              : msg.content
                            }
                            {/* Guardrail warnings — shown when AI content may not align with course material */}
                            {!msg.loading && msg.warnings && msg.warnings.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-1">
                                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                                  ⚠ Content Review Suggested
                                </span>
                                {msg.warnings.map((w, wi) => (
                                  <p key={wi} className="text-[10px] text-amber-300/80 leading-relaxed">{w}</p>
                                ))}
                              </div>
                            )}
                          </div>

                          {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-300">You</span>
                            </div>
                          )}

                        </div>

                      ))}

                      <div ref={chatEndRef} />

                    </div>

                    {/* Chat input */}

                    {!selectedClassId && (
                      <p className="text-[10px] text-amber-400 text-center mb-2">Select a class to use AI Chat</p>
                    )}

                    <div className="flex gap-2 shrink-0">

                      <textarea
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                        placeholder="e.g. Write 5 hard questions about binary trees…"
                        rows={2}
                        disabled={chatLoading || !selectedClassId}
                        className="flex-1 bg-[#0f1623] border border-slate-800 focus:border-[#00e5a0]/50 rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-all placeholder:text-slate-600 resize-none disabled:opacity-40"
                      />

                      <button
                        onClick={handleChat}
                        disabled={chatLoading || !chatInput.trim() || !selectedClassId}
                        className="px-4 bg-[#00e5a0]/10 hover:bg-[#00e5a0]/20 border border-[#00e5a0]/30 text-[#00e5a0] rounded-xl transition-all disabled:opacity-40 flex items-center"
                      >
                        {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>

                    </div>

                  </div>

                )}

                {activeTab !== 'AI Chat' && (
                  <button onClick={() => setShowAddModal(true)}

                    className="w-full mt-2 py-2.5 border border-dashed border-slate-800 hover:border-[#00e5a0]/40 rounded-xl text-[10px] font-bold text-slate-600 hover:text-[#00e5a0] transition-all flex items-center justify-center gap-2">

                    <Plus size={12} /> Add {activeTab === 'Topics' ? 'topic' : activeTab === 'Lessons' ? 'lesson' : 'question'} manually

                  </button>
                )}

              </div>

              {/* Stats + Flow CTA footer */}
              <div className="mt-6 pt-5 border-t border-slate-800 space-y-4 shrink-0">

                {/* Stats row */}
                <div className="flex items-center gap-5">
                  {[['Topics', topics.length], ['Lessons', lessons.length], ['Questions', problems.length]].map(([label, count]) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                      <p className="text-sm font-bold text-white">{count}</p>
                    </div>
                  ))}
                  <div className="ml-auto text-[10px] text-slate-600 italic">
                    {processingCount > 0 ? `Extracting from ${processingCount} file${processingCount > 1 ? 's' : ''}…` : 'Synced with DB'}
                  </div>
                </div>

                {/* Flow Designer CTA */}
                {onFlowDesignerClick && (
                  <div className="rounded-2xl border border-slate-800 bg-[#0d1526] p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                      <GitBranch size={18} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white">Apply a Learning Flow</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Design how students progress through this content — Socratic Retry, Mastery Gate & more.
                      </p>
                    </div>
                    <button
                      onClick={onFlowDesignerClick}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl text-[10px] font-bold transition-all"
                    >
                      Open <ArrowRight size={11} />
                    </button>
                  </div>
                )}

              </div>

            </div>

          </section>

        </div>

      </main>

    </div>

  );

};

const EmptyState: React.FC<{ tab: string }> = ({ tab }) => (

  <div className="text-center py-10">

    <Sparkles size={24} className="text-slate-700 mx-auto mb-2" />

    <p className="text-[11px] text-slate-600">No {tab} yet.</p>

    <p className="text-[10px] text-slate-700 mt-1">Upload a PDF and click Extract Content, or add manually.</p>

  </div>

);

export default CourseBuilderPage;

