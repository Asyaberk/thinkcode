import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Save, Send, Upload, FileText, Video, Trash2, Edit3,
  Sparkles, Layers, RefreshCw, ArrowRight, FileAudio, Check,
  AlertCircle, Loader2, X, BookOpen, HelpCircle, CheckCircle2,
  Circle, Clock, Link, Globe, ExternalLink
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
  ResourceItem, DbTopic, DbLesson, DbProblem,
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
  onLogout?: () => void;
  userRole?: UserRole;
}

type Tab = 'Topics' | 'Lessons' | 'Questions';

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
  <div className="bg-[#0f1623] border border-slate-800 p-4 rounded-xl group hover:border-[#00e5a0]/30 transition-all">
    <div className="flex justify-between items-start">
      <div className="flex-1 min-w-0">
        <h3 className="text-xs font-bold text-white group-hover:text-[#00e5a0] transition-colors">{topic.name}</h3>
        {topic.description && <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{topic.description}</p>}
      </div>
      <CardActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  </div>
);

const LessonCard: React.FC<{ lesson: DbLesson; onEdit: () => void; onDelete: () => void }> = ({ lesson, onEdit, onDelete }) => (
  <div className="bg-[#0f1623] border border-slate-800 p-4 rounded-xl group hover:border-[#00e5a0]/30 transition-all">
    <div className="flex justify-between items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={13} className="text-slate-500 shrink-0" />
          <h3 className="text-xs font-bold text-white group-hover:text-[#00e5a0] transition-colors">{lesson.title}</h3>
          {lesson.estimated_minutes && (
            <span className="ml-auto text-[9px] text-slate-600 flex items-center gap-0.5 shrink-0">
              <Clock size={9} /> {lesson.estimated_minutes}m
            </span>
          )}
        </div>
        {lesson.summary && <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{lesson.summary}</p>}
        {lesson.content_markdown && (
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
            <p className="text-[10px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4">
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
  <div className="bg-[#0f1623] border border-slate-800 p-4 rounded-xl group hover:border-[#00e5a0]/30 transition-all">
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
  onSectionSelect, onInstructorDashboardClick, onCourseBuilderClick,
  onFlowDesignerClick, onLogout, userRole
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('Topics');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [weekName, setWeekName] = useState('');

  // Sınıf seçimi — Instructor hangi sınıf için içerik yükleyecek
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<{id: string; code: string; name: string}[]>([]);

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

  // Content
  const [topics, setTopics] = useState<DbTopic[]>([]);
  const [lessons, setLessons] = useState<DbLesson[]>([]);
  const [problems, setProblems] = useState<DbProblem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Sınıfları yükle
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const { api } = await import('../api/client');
        const classes = await api.get<{class_id: string; class_code: string; class_name: string}[]>('/instructor/me/classes');
        const mapped = classes.map(c => ({ id: c.class_id, code: c.class_code, name: c.class_name }));
        setAvailableClasses(mapped);
        if (mapped.length > 0) setSelectedClassId(mapped[0].id);
      } catch { /* instructor without classes */ }
    };
    loadClasses();
  }, []);

  useEffect(() => {
    loadFiles();
    loadAllContent();
    return () => { Object.values(pollingRefs.current).forEach(clearInterval); };
  }, [selectedClassId]);

  const loadFiles = async () => {
    try {
      const data = await listResources();
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
    setUploading(true); setUploadError('');
    try {
      const result = await uploadResource(file, weekName.trim() || undefined);
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
      try {
        await processResource(result.resource_id, selectedClassId || undefined);
        setFiles(prev => prev.map(f => f.resource_id === result.resource_id ? { ...f, status: 'processing' } : f));
        startPolling(result.resource_id);
      } catch { /* already processing */ }
    } catch (err: any) { setUploadError(err.message || 'Upload failed'); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !linkTitle.trim()) {
      setLinkError('URL ve başlık zorunludur.');
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
      setLinkSuccess('Link başarıyla eklendi!');
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
        await processResource(f.resource_id, selectedClassId || undefined);
        setFiles(prev => prev.map(r => r.resource_id === f.resource_id ? { ...r, status: 'processing' } : r));
        startPolling(f.resource_id);
      } catch { /* ignore */ }
    }
    setIsExtracting(false);
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
  const pendingCount = files.filter(f => f.status === 'uploaded').length;

  const StatusBadge = ({ status }: { status: ResourceItem['status'] }) => {
    if (status === 'processing') return <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500"><Loader2 size={10} className="animate-spin" /> Processing...</span>;
    if (status === 'done') return <span className="flex items-center gap-1 text-[9px] font-bold text-[#00e5a0]"><Check size={10} /> DONE ✓</span>;
    if (status === 'failed') return <span className="flex items-center gap-1 text-[9px] font-bold text-red-500"><AlertCircle size={10} /> Error ✗</span>;
    return <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><Check size={10} /> Uploaded</span>;
  };

  const fileIcon = (type: string) => {
    if (['mp4', 'mov'].includes(type)) return <Video size={16} />;
    if (['mp3', 'wav'].includes(type)) return <FileAudio size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="flex h-screen bg-[#0f1623] text-slate-200 overflow-hidden font-sans">
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
        onLogout={onLogout} userRole={userRole}
      />

      <main className="flex-1 overflow-hidden ml-72 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0f1623] shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Course Builder</h1>
            <p className="text-xs text-slate-500">
              {weekName || 'Upload and manage course content'}
              {processingCount > 0 && <span className="ml-2 text-amber-500">· processing {processingCount} file{processingCount > 1 ? 's' : ''}…</span>}
            </p>
          </div>
          {/* Sınıf seçici */}
          {availableClasses.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class:</span>
              <div className="flex gap-2">
                {availableClasses.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border',
                      selectedClassId === cls.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {cls.code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">

          {/* LEFT: Resources */}
          <section className="w-[40%] flex flex-col">
            <div className="bg-[#1a2235] rounded-2xl border border-slate-800 p-5 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-6 shrink-0">
                <Layers size={18} className="text-[#00e5a0]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Resources</h2>
              </div>

              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                {/* Sekme seçici */}
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
                    <div className="shrink-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Module Label</label>
                      <input type="text" value={weekName} onChange={e => setWeekName(e.target.value)}
                        placeholder="e.g. Week 4: C++ Pointers"
                        className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <label htmlFor="cb-file-upload" className={cn(
                      'border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center',
                      'hover:border-[#00e5a0]/50 transition-all group cursor-pointer bg-[#0f1623]/50 shrink-0',
                      uploading && 'opacity-60 pointer-events-none'
                    )}>
                      <input id="cb-file-upload" ref={fileInputRef} type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.cpp,.h,.py"
                        className="hidden" onChange={handleFileChange} disabled={uploading} />
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3 text-slate-500 group-hover:text-[#00e5a0] transition-colors">
                        {uploading ? <Loader2 size={24} className="animate-spin text-[#00e5a0]" /> : <Upload size={24} />}
                      </div>
                      <p className="text-xs font-bold text-white mb-1">{uploading ? 'Uploading & processing…' : 'Upload Materials'}</p>
                      <p className="text-[10px] text-slate-500">PDF, MD, TXT, PNG, JPG, CPP</p>
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
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Başlık *</label>
                      <input type="text" value={linkTitle} onChange={e => setLinkTitle(e.target.value)}
                        placeholder="Ders Videosu — Hafta 3"
                        className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tür</label>
                        <select value={linkType} onChange={e => setLinkType(e.target.value as any)}
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none">
                          <option value="link">🔗 Web Linki</option>
                          <option value="video">🎬 Video</option>
                          <option value="pdf">📄 PDF Linki</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Modül (opsiyonel)</label>
                        <input type="text" value={linkWeekName} onChange={e => setLinkWeekName(e.target.value)}
                          placeholder="Week 3"
                          className="w-full bg-[#0f1623] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-1 focus:ring-[#00e5a0] outline-none transition-all placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                    {linkError && <div className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{linkError}</div>}
                    {linkSuccess && <div className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-1"><Check size={12}/>{linkSuccess}</div>}
                    <button onClick={handleAddLink} disabled={linkAdding || !linkUrl.trim() || !linkTitle.trim()}
                      className="w-full py-3 bg-[#00e5a0]/10 hover:bg-[#00e5a0]/20 border border-[#00e5a0]/30 text-[#00e5a0] rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                      {linkAdding ? <><Loader2 size={14} className="animate-spin" />Ekleniyor…</> : <><Globe size={14} />Link Ekle</>}
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {files.length === 0 && <p className="text-[11px] text-slate-600 text-center pt-6">Henüz kaynak yok. PDF yükle veya link ekle.</p>}

                  {/* Aynı modül label'ı olanları grupla */}
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
                                  <StatusBadge status={file.status} />
                                  {!file.week_name && <span className="text-[9px] text-slate-700">modül yok</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Aç butonu — PDF veya link */}
                              {href && file.status === 'done' && (
                                <a href={href} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 text-slate-500 hover:text-[#00e5a0] transition-colors"
                                  title={file.has_file ? 'PDF\'yi Aç' : 'Linki Aç'}>
                                  {file.has_file ? <FileText size={13} /> : <ExternalLink size={13} />}
                                </a>
                              )}
                              <button
                                onClick={async () => {
                                  if (!confirm(`"${file.filename || file.title}" silinsin mi?`)) return;
                                  try {
                                    const token = localStorage.getItem('access_token') ?? '';
                                    const res = await fetch(
                                      `/api/v1/resources/${file.resource_id}`,
                                      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    if (res.ok || res.status === 204) {
                                      setFiles(prev => prev.filter(f => f.resource_id !== file.resource_id));
                                    } else {
                                      alert('Silme başarısız: ' + res.status);
                                    }
                                  } catch {
                                    alert('Bağlantı hatası — kaynak silinemedi.');
                                  }
                                }}
                                className="p-1.5 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Sil">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <button onClick={handleExtract} disabled={isExtracting || pendingCount === 0}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 shrink-0">
                  {isExtracting
                    ? <><Loader2 size={16} className="animate-spin" /> Sending to AI…</>
                    : <> Extract Content <ArrowRight size={16} className="text-[#00e5a0]" />
                        {pendingCount > 0 && <span className="bg-[#00e5a0]/20 text-[#00e5a0] text-[9px] font-black px-1.5 py-0.5 rounded">{pendingCount}</span>}
                      </>}
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: AI Content */}
          <section className="flex-1 flex flex-col">
            <div className="bg-[#1a2235] rounded-2xl border border-slate-800 p-5 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[#00e5a0]" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">AI Content</h2>
                </div>
                <button onClick={async () => { setIsRegenerating(true); await loadAllContent(); setIsRegenerating(false); }}
                  disabled={isRegenerating}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[#00e5a0] transition-all disabled:opacity-50">
                  {isRegenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
              </div>

              <div className="flex p-1 bg-[#0f1623] rounded-xl mb-6 shrink-0">
                {(['Topics', 'Lessons', 'Questions'] as Tab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn('flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all',
                      activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300')}>
                    {tab}
                    <span className="ml-1.5 text-[8px] font-black opacity-60">
                      {tab === 'Topics' ? topics.length : tab === 'Lessons' ? lessons.length : problems.length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
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

                <button onClick={() => setShowAddModal(true)}
                  className="w-full py-3 border border-dashed border-slate-800 rounded-xl text-[10px] font-bold text-slate-500 hover:text-[#00e5a0] hover:border-[#00e5a0]/50 transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> + Add {activeTab.slice(0, -1)} manually
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-5 shrink-0">
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
