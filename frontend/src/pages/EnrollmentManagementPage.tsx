import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, CheckCircle, XCircle, Clock,
  RefreshCw, Search, GraduationCap, AlertTriangle
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Section, UserRole } from '../types';
import { cn } from '../lib/utils';
import {
  listEnrollments, approveEnrollment, rejectEnrollment,
  EnrollmentRecord
} from '../hooks/useCourses';

interface EnrollmentManagementPageProps {
  sections: Section[];
  classId: string;                   // active course — same prop name as CourseBuilder/FlowDesigner
  onSectionSelect: (id: string) => void;
  onDashboardClick: () => void;
  onProblemsClick?: () => void;
  onInstructorDashboardClick?: () => void;
  onCourseBuilderClick?: () => void;
  onFlowDesignerClick?: () => void;
  onEnrollmentManagementClick?: () => void;
  onLogout?: () => void;
  onSwitchCourse?: () => void;
  userRole?: UserRole;
  courseName?: string;
  token: string | null;
  activeAnalyticsView?: string;
  onAnalyticsViewChange?: (view: string) => void;
}

type FilterTab = 'pending' | 'enrolled';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   icon: Clock },
  active:   { label: 'Active',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',       icon: XCircle },
  dropped:  { label: 'Dropped',  color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30',   icon: XCircle },
};

export const EnrollmentManagementPage: React.FC<EnrollmentManagementPageProps> = ({
  sections, classId, onSectionSelect, onDashboardClick, onProblemsClick,
  onInstructorDashboardClick, onCourseBuilderClick, onFlowDesignerClick,
  onEnrollmentManagementClick, onLogout, onSwitchCourse,
  userRole, courseName, token,
  activeAnalyticsView, onAnalyticsViewChange,
}) => {
  const [filter, setFilter]           = useState<FilterTab>('pending');
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [search, setSearch]           = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEnrollments = useCallback(async () => {
    if (!token || !classId) return;
    setIsLoading(true);
    try {
      const data = await listEnrollments(classId, token, filter === 'enrolled' ? 'active' : filter);
      setEnrollments(data);
      // keep pending badge up to date
      if (filter !== 'pending') {
        const pend = await listEnrollments(classId, token, 'pending');
        setPendingCount(pend.length);
      } else {
        setPendingCount(data.length);
      }
    } catch (e: any) {
      showToast(`Failed to load enrollments: ${e.message}`, false);
    } finally {
      setIsLoading(false);
    }
  }, [token, classId, filter]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const handleApprove = async (enr: EnrollmentRecord) => {
    if (!token) return;
    setActionLoading(enr.enrollment_id);
    try {
      await approveEnrollment(classId, enr.enrollment_id, token);
      showToast(`✓ ${enr.first_name} ${enr.last_name} approved!`);
      fetchEnrollments();
    } catch (e: any) {
      showToast(`Approve failed: ${e.message}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (enr: EnrollmentRecord) => {
    if (!token) return;
    setActionLoading(enr.enrollment_id);
    try {
      await rejectEnrollment(classId, enr.enrollment_id, token);
      showToast(`Rejected ${enr.first_name} ${enr.last_name}.`, true);
      fetchEnrollments();
    } catch (e: any) {
      showToast(`Reject failed: ${e.message}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = enrollments.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q)
    );
  });

  const tabs: FilterTab[] = ['pending', 'enrolled'];

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar
        sections={sections}
        activeSectionId="enrollment-management"
        onSectionSelect={onSectionSelect}
        onDashboardClick={onDashboardClick}
        onProblemsClick={onProblemsClick}
        onInstructorDashboardClick={onInstructorDashboardClick}
        onCourseBuilderClick={onCourseBuilderClick}
        onFlowDesignerClick={onFlowDesignerClick}
        onEnrollmentManagementClick={onEnrollmentManagementClick}
        pendingEnrollmentsCount={pendingCount}
        onSwitchCourse={onSwitchCourse}
        onLogout={onLogout}
        userRole={userRole}
        courseName={courseName}
        progressPercent={0}
        activeAnalyticsView={activeAnalyticsView}
        onAnalyticsViewChange={onAnalyticsViewChange}
      />

      <div className="flex-1 ml-72 p-8 lg:p-12 text-slate-200">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Enrollment Management</h1>
                {courseName && (
                  <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">
                    {courseName}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex gap-3 items-start">
              <span className="text-xl shrink-0">🎓</span>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">Manage who can access your course</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Students who request to join this course appear here as <span className="text-amber-400 font-semibold">Pending</span>. Approve them to grant access,
                  or reject if they don't belong to your section. Removing an active student immediately revokes their access to all course content.
                </p>
                <div className="flex gap-4 mt-2">
                  {[
                    { dot: '#f59e0b', label: 'Pending — awaiting your decision' },
                    { dot: '#10b981', label: 'Active — enrolled & can practice' },
                    { dot: '#ef4444', label: 'Rejected / Removed' },
                  ].map(({ dot, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                      <span className="text-[10px] text-slate-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>


          {!classId ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600">
              <GraduationCap size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">No course selected.</p>
              <p className="text-sm mt-1">Go back to your course list and click Manage on a course.</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Filter Tabs + Search */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className={cn(
                        'px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                        filter === tab
                          ? tab === 'pending'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {tab === 'pending' ? 'Pending' : 'Enrolled'}
                      {tab === 'pending' && pendingCount > 0 && (
                        <span className="ml-1.5 bg-slate-950/30 rounded-full px-1">{pendingCount}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search students..."
                    className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <button
                  onClick={fetchEnrollments}
                  title="Refresh"
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Requested</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</span>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <RefreshCw size={20} className="animate-spin mr-2" />
                    Loading...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                    <Users size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">
                      {filter === 'pending' ? 'No pending requests 🎉' : 'No students found.'}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {filtered.map((enr, i) => {
                      const cfg = STATUS_CONFIG[enr.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                      const Icon = cfg.icon;
                      const isActing = actionLoading === enr.enrollment_id;
                      const requestedDate = enr.requested_at
                        ? new Date(enr.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                        : '—';

                      return (
                        <motion.div
                          key={enr.enrollment_id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: i * 0.03 }}
                          className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-6 py-4 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition-colors items-center"
                        >
                          {/* Name + status badge */}
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                              {enr.first_name[0]}{enr.last_name[0]}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{enr.first_name} {enr.last_name}</div>
                              <span className={cn('text-[10px] font-bold flex items-center gap-1 mt-0.5', cfg.color)}>
                                <Icon size={10} />
                                {cfg.label}
                              </span>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="text-sm text-slate-400 truncate">{enr.email}</div>

                          {/* Date */}
                          <div className="text-sm text-slate-500">{requestedDate}</div>

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2">
                            {enr.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(enr)}
                                  disabled={isActing}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 active:scale-95"
                                >
                                  <CheckCircle size={12} />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(enr)}
                                  disabled={isActing}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-all disabled:opacity-50 active:scale-95"
                                >
                                  <XCircle size={12} />
                                  Reject
                                </button>
                              </>
                            )}
                            {enr.status === 'active' && (
                              <button
                                onClick={() => handleReject(enr)}
                                disabled={isActing}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl text-xs font-bold hover:border-red-500/40 hover:text-red-400 transition-all disabled:opacity-50"
                              >
                                <XCircle size={12} />
                                Remove
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {!isLoading && filtered.length > 0 && (
                <div className="mt-3 text-xs text-slate-600 text-right">
                  {filtered.length} student{filtered.length !== 1 ? 's' : ''} shown
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl z-50 flex items-center gap-2',
              toast.ok ? 'bg-emerald-500 text-slate-950' : 'bg-red-500/90 text-white'
            )}
          >
            {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
