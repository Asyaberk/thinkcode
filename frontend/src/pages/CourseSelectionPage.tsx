import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Users, Clock, ArrowRight, CheckCircle2, Plus, X, Upload, Palette, LogOut, Award, Download } from 'lucide-react';
import { Course, UserRole } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface CourseSelectionPageProps {
  courses: Course[];
  enrolledCourseIds: string[];
  pendingCourseIds?: string[];
  userRole: UserRole;
  onCourseSelect: (courseId: string) => void;
  onEnroll: (courseId: string) => void;
  onUnenroll: (courseId: string) => void;
  onAddCourse: (formData: any) => Promise<void> | void;
  onEditCourse: (course: Course | any) => Promise<void> | void;
  onDeleteCourse: (courseId: string) => void;
  onLogout: () => void;
  onDiscover?: () => void;
}

export const CourseSelectionPage: React.FC<CourseSelectionPageProps> = ({
  courses,
  enrolledCourseIds,
  pendingCourseIds = [],
  userRole,
  onCourseSelect,
  onEnroll,
  onUnenroll,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
  onLogout,
  onDiscover
}) => {
  const { user } = useAuth();
  const displayName = user ? `${user.first_name} ${user.last_name}` : 'there';
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Enrollment state — use enrollmentStatus from Course (from API, no optimistic guess)
  const handleEnrollClick = (courseId: string) => {
    onEnroll(courseId); // triggers refetch after API call — status shows as pending from DB
  };

  const handleUnenrollClick = (courseId: string, isPending = false) => {
    const msg = isPending
      ? 'Are you sure you want to cancel your enrollment request?'
      : 'Are you sure you want to leave this course?';
    if (window.confirm(msg)) {
      onUnenroll(courseId);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    term: 'Current Term',
    color: '#10b981',
    thumbnail: '',
    tags: '',          // virgülle ayrılmış: "AI, Python, Machine Learning"
    category: 'Computer Science',
    level: 'Beginner'
  });

  const [showCertificatesModal, setShowCertificatesModal] = useState(false);

  // Instructor: all come from /classes/my
  const instructorOwnedCourses = courses;
  // Student course categories — use enrollmentStatus from API
  const activeCourses    = courses.filter(c => c.enrollmentStatus === 'active' && (c.progress ?? 0) < 100);
  const pendingCourses   = courses.filter(c => c.enrollmentStatus === 'pending');
  const completedCourses = courses.filter(c => c.enrollmentStatus === 'active' && c.progress === 100);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (editingCourse) {
        await onEditCourse({ ...editingCourse, ...formData });
      } else {
        await onAddCourse(formData);
      }
      closeModal(); // sadece başarılı olunca kapat
    } catch (err: any) {
      setSubmitError(err.message || 'Bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      description: course.description,
      term: course.term,
      color: course.color,
      thumbnail: course.thumbnail || '',
      tags: course.tags || '',
      category: 'Computer Science',
      level: 'Beginner'
    });
    setShowAddCourse(true);
  };

  const closeModal = () => {
    setShowAddCourse(false);
    setEditingCourse(null);
    setFormData({ name: '', code: '', description: '', term: 'Spring 2024', color: '#10b981', thumbnail: '', tags: '', category: 'Computer Science', level: 'Beginner' });
  };

  return (
    <div className="min-h-screen bg-ui-bg text-slate-200 p-6 md:p-12 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

      {/* Fixed ThinkCode Logo — sol üst köşe */}
      <div className="fixed top-5 left-6 z-10 flex items-center gap-3 pointer-events-none">
        <img
          src="/thinkcode_logo.png"
          alt="ThinkCode Logo"
          className="h-9 w-auto object-contain shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="leading-none">
          <span className="text-[17px] font-light text-slate-300 tracking-tight">Think</span>
          <span className="text-[17px] font-bold text-emerald-400 tracking-tight">Code</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 pt-16 space-y-16">

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10"
        >
            <div className="relative">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-16 bg-emerald-500 rounded-full blur-sm" />
              <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter leading-none">
                Hello, <br/>
                <span className="text-emerald-500">
                  {userRole === 'Instructor' ? `Professor ${displayName}.` : `Scholar ${displayName}.`}
                </span>
              </h1>
              <p className="text-slate-400 font-medium max-w-lg text-lg leading-relaxed">
                {userRole === 'Instructor' 
                  ? 'Manage your academic empire or architect a new learning experience for your students.' 
                  : 'Keep pushing forward! Your courses are waiting for your next breakthrough.'}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              {userRole === 'Student' && onDiscover && (
                <button 
                  onClick={onDiscover}
                  className="flex items-center gap-3 px-10 py-5 bg-emerald-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-2xl shadow-emerald-500/30 active:scale-95 group"
                >
                  <BookOpen size={20} className="group-hover:scale-110 transition-transform" />
                  Discover New Courses
                </button>
              )}
              {userRole === 'Instructor' && (
                <button 
                  onClick={() => setShowAddCourse(true)}
                  className="flex items-center gap-3 px-10 py-5 bg-emerald-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-2xl shadow-emerald-500/30 active:scale-95 group"
                >
                  <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                  Add New Course
                </button>
              )}
              <div className="p-1 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center">
                <button 
                  onClick={onLogout}
                  className="px-6 py-4 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2 group"
                >
                  <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" />
                  Logout
                </button>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            {userRole === 'Instructor' ? (
              <>
                <StatCard label="Published" value={instructorOwnedCourses.length} icon={BookOpen} color="text-blue-400" />
                <StatCard label="Active Students" value={instructorOwnedCourses.reduce((acc, c) => acc + (c.studentsCount || 0), 0)} icon={Users} color="text-emerald-400" />
                <StatCard label="Completed" value={Math.floor(instructorOwnedCourses.reduce((acc, c) => acc + (c.studentsCount || 0), 0) * 0.4)} icon={CheckCircle2} color="text-orange-400" />
                <StatCard label="Learning Hours" value={`${instructorOwnedCourses.length * 12}h`} icon={Clock} color="text-purple-400" />
              </>
            ) : (
              <>
                <StatCard label="Enrolled" value={enrolledCourseIds.length} icon={BookOpen} color="text-blue-400" />
                <StatCard label="Completed" value={completedCourses.length} icon={CheckCircle2} color="text-emerald-400" />
                <StatCard label="Total Available" value={courses.length} icon={Users} color="text-orange-400" />
                <div 
                  onClick={() => setShowCertificatesModal(true)}
                  className="bg-[#1e293b]/20 border border-emerald-500/30 p-6 rounded-[2rem] hover:bg-emerald-500/10 cursor-pointer transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 shadow-inner text-emerald-400 group-hover:scale-110 transition-transform">
                    <Award size={20} />
                  </div>
                  <div className="text-2xl font-black text-white">Show</div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">My Certificates</div>
                </div>
              </>
            )}
          </div>

        {userRole === 'Student' ? (
          <div className="space-y-20">
            {/* Active Courses */}
            {activeCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
                  <h2 className="text-xl font-bold text-white uppercase tracking-widest text-[11px]">Active Courses</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {activeCourses.map((course, index) => (
                    <CourseCard 
                      key={course.id} 
                      course={course} 
                      index={index} 
                      isEnrolled={true} 
                      onAction={() => onCourseSelect(course.id)}
                      onUnenroll={() => handleUnenrollClick(course.id)}
                      userRole={userRole}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pending Approval */}
            {pendingCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                  <h2 className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">Pending Approval</h2>
                  <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] font-black text-amber-400">
                    Awaiting instructor review
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {pendingCourses.map((course, index) => (
                    <div key={course.id} className="relative">
                      <CourseCard 
                        course={course} 
                        index={index} 
                        isEnrolled={false}
                        isPending={true}
                        onAction={() => {}}
                        onUnenroll={() => handleUnenrollClick(course.id, true)}
                        userRole={userRole}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed Courses */}
            {completedCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-1.5 h-8 bg-slate-600 rounded-full" />
                  <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Completed Courses</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {completedCourses.map((course, index) => (
                    <CourseCard 
                      key={course.id} 
                      course={course} 
                      index={index} 
                      isEnrolled={true} 
                      onAction={() => onCourseSelect(course.id)}
                      userRole={userRole}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {activeCourses.length === 0 && pendingCourses.length === 0 && completedCourses.length === 0 && (
              <div className="text-center py-24 text-slate-600">
                <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-bold text-slate-500">You haven&apos;t enrolled in any courses yet.</p>
                <p className="text-sm text-slate-600 mt-2">Click &quot;Discover New Courses&quot; to get started.</p>
              </div>
            )}
          </div>

        ) : (
          <section>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
              <h2 className="text-xl font-bold text-white uppercase tracking-widest text-[11px]">Managed Hub</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {instructorOwnedCourses.map((course, index) => (
                <CourseCard 
                  key={course.id} 
                  course={course} 
                  index={index} 
                  isEnrolled={true} 
                  onAction={() => onCourseSelect(course.id)}
                  onEdit={() => openEditModal(course)}
                  onDelete={() => onDeleteCourse(course.id)}
                  userRole={userRole}
                />
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setShowAddCourse(true)}
                className="flex flex-col items-center justify-center p-12 bg-[#1e293b]/10 border-2 border-dashed border-slate-800 rounded-[2.5rem] cursor-pointer hover:border-emerald-500/50 hover:bg-[#1e293b]/20 transition-all group"
              >
                <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center text-slate-500 mb-6 group-hover:scale-110 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-all duration-500">
                  <Plus size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-300">Add New Course</h3>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-[200px]">Start building your next academic masterpiece</p>
              </motion.div>
            </div>
          </section>
        )}
      </div>

      {/* Add/Edit Course Modal */}
      <AnimatePresence>
        {showAddCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/5 rounded-[3rem] p-10 md:p-16 overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={closeModal} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-6 mb-12">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 shadow-inner">
                  <BookOpen size={30} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">{editingCourse ? 'Refine Course' : 'Architect Course'}</h2>
                  <p className="text-slate-500 text-sm font-medium">Define the core values and visual identity of your course</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Course Title</label>
                    <input 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-700 font-bold"
                      placeholder="e.g. Modern Architecture"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unique Code</label>
                    <input 
                      required
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-700 font-bold"
                      placeholder="e.g. ARCH101"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Curriculum Overview</label>
                  <textarea 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-32 transition-all placeholder:text-slate-700 font-medium leading-relaxed"
                    placeholder="What mysteries will your students unravel?"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Visual Thumbnail (URL)</label>
                    <div className="relative">
                      <input 
                        value={formData.thumbnail}
                        onChange={e => setFormData({...formData, thumbnail: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all pl-12"
                        placeholder="https://images.unsplash.com/..."
                      />
                      <Upload size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tags <span className="text-slate-600 normal-case">(comma separated)</span></label>
                    <div className="relative">
                      <input 
                        value={formData.tags}
                        onChange={e => setFormData({...formData, tags: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all pl-12 placeholder:text-slate-700"
                        placeholder="AI, Machine Learning, Python"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-base">#</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Theme Color</label>
                    <div className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <input 
                        type="color" 
                        value={formData.color}
                        onChange={e => setFormData({...formData, color: e.target.value})}
                        className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white mb-0.5">Primary Accent</div>
                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Interface branding</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 flex-col">
                  {submitError && (
                    <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      ⚠ {submitError}
                    </div>
                  )}
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      className="flex-1 bg-white/5 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] bg-emerald-500 text-slate-950 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {isSubmitting ? 'Saving...' : editingCourse ? 'Update Course' : 'Create Course'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Certificate Modal */}
      <AnimatePresence>
        {showCertificatesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowCertificatesModal(false)}
               className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-xl bg-slate-900 border border-white/5 rounded-[3rem] p-12 overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={() => setShowCertificatesModal(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-6 mb-10">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 shadow-inner">
                  <Award size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Your Achievements</h2>
                  <p className="text-slate-500 text-sm font-medium">Download your credentials and share your success</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {completedCourses.length > 0 ? (
                  completedCourses.map((course) => (
                    <div 
                      key={course.id}
                      className="group flex items-center justify-between p-6 bg-slate-950 rounded-2xl border border-slate-800 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-600">
                          <BookOpen size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{course.name}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Completed {course.term}</p>
                        </div>
                      </div>
                      <button className="p-3 bg-white/5 hover:bg-emerald-500 hover:text-slate-950 rounded-xl text-slate-400 transition-all">
                        <Download size={18} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-950 rounded-3xl border border-dashed border-slate-800">
                    <Award size={40} className="mx-auto text-slate-800 mb-4" />
                    <p className="text-slate-500 font-bold text-sm tracking-tight">No certificates earned yet.</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">Finish a course to unlock your credentials</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-[#1e293b]/20 border border-slate-800/50 p-6 rounded-[2rem] hover:bg-[#1e293b]/30 transition-all flex flex-col"
  >
    <div className={cn("w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center mb-4 shadow-inner", color)}>
      <Icon size={20} />
    </div>
    <div className="text-2xl font-black text-white">{value}</div>
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</div>
  </motion.div>
);

export interface CourseCardProps {
  course: Course;
  index: number;
  isEnrolled: boolean;
  isPending?: boolean;
  onAction: () => void;
  onUnenroll?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  userRole: UserRole;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, index, isEnrolled, isPending = false, onAction, onUnenroll, onEdit, onDelete, userRole }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="group relative bg-[#1e293b]/40 border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-emerald-500/30 transition-all hover:shadow-[0_20px_50px_-20px_rgba(0,229,160,0.15)] flex flex-col h-full"
  >
    <div 
      className="h-48 w-full relative overflow-hidden"
      style={{ backgroundColor: course.color + '11' }}
    >
      {course.thumbnail ? (
        <img src={course.thumbnail} alt={course.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <BookOpen size={48} style={{ color: course.color }} className="opacity-10" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent opacity-80" />
      <div className="absolute top-6 left-6">
        <span className="px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-black tracking-[0.2em] text-white uppercase border border-white/10">
          {course.code}
        </span>
      </div>
      {isEnrolled && userRole === 'Student' && course.progress === 100 && (
        <div className="absolute top-6 right-6">
          <div className="bg-emerald-500 p-2 rounded-full text-slate-950 shadow-lg shadow-emerald-500/40">
            <CheckCircle2 size={16} strokeWidth={3} />
          </div>
        </div>
      )}
      {isPending && userRole === 'Student' && (
        <div className="absolute top-6 right-6">
          <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Clock size={11} className="text-amber-400" />
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Pending</span>
          </div>
        </div>
      )}
      
      {userRole === 'Instructor' && onEdit && onDelete && (
        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl text-white transition-all border border-white/10"
          >
            <Palette size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 bg-red-500/10 backdrop-blur-md hover:bg-red-500/20 rounded-xl text-red-500 transition-all border border-red-500/20"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>

    <div className="p-10 flex flex-col flex-1">
      <div className="flex-1">
        <h3 className="text-2xl font-black text-white mb-3 group-hover:text-emerald-400 transition-colors tracking-tight leading-tight">{course.name}</h3>
        <p className="text-slate-400 text-[13px] leading-relaxed line-clamp-3 mb-8 font-medium">{course.description}</p>
        
        <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] mb-10">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-600" />
            <span>{course.term}</span>
          </div>
          {userRole === 'Instructor' ? (
            <div className="flex items-center gap-2">
              <Users size={14} className="text-emerald-500" />
              <span>{course.studentsCount} Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span>{course.instructorName}</span>
            </div>
          )}
        </div>
      </div>

      {userRole === 'Student' && isEnrolled && (
        <div className="mb-10">
          <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
            <span>Core Mastery</span>
            <span className="text-emerald-400">{course.progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${course.progress}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-out"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button 
          onClick={!isPending ? onAction : undefined}
          disabled={isPending}
          className={cn(
            "flex-1 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl",
            isPending
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed"
              : isEnrolled || userRole === 'Instructor'
                ? "bg-slate-800 text-white hover:bg-emerald-500 hover:text-slate-950 shadow-emerald-500/5 hover:shadow-emerald-500/20" 
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20"
          )}
        >
          {isPending ? '⏳ Pending Approval' : userRole === 'Instructor' ? 'Manage' : (isEnrolled ? 'Resume' : 'Request to Join')}
        </button>
        {(isEnrolled || isPending) && userRole === 'Student' && onUnenroll && (
          <button 
            onClick={(e) => { e.stopPropagation(); onUnenroll(); }}
            title={isPending ? 'Cancel Request' : 'Leave Course'}
            className="w-16 h-16 rounded-2xl border border-white/5 flex items-center justify-center text-slate-600 hover:text-red-500 hover:border-red-500/30 transition-all hover:bg-red-500/10 group/unenroll"
          >
            <X size={20} className="group-hover/unenroll:rotate-90 transition-transform" />
          </button>
        )}
      </div>
    </div>
  </motion.div>
);
