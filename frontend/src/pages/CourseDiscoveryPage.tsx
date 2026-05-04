import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowLeft, BookOpen, Loader2, Users, Clock, X, Tag, CheckCircle2 } from 'lucide-react';
import { Course } from '../types';
import { useAuth } from '../context/AuthContext';
import { searchCourses } from '../hooks/useCourses';
import { cn } from '../lib/utils';

interface CourseDiscoveryPageProps {
  enrolledCourseIds: string[];
  pendingCourseIds?: string[];
  onEnroll: (courseId: string) => Promise<void>;
  onBack: () => void;
}

// ── Course Detail Modal ───────────────────────────────────────────────────────
const CourseDetailModal: React.FC<{
  course: Course;
  isEnrolled: boolean;
  isPending: boolean;
  isEnrolling: boolean;
  onEnroll: () => void;
  onClose: () => void;
}> = ({ course, isEnrolled, isPending, isEnrolling, onEnroll, onClose }) => {
  const tagList = course.tags ? course.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="relative w-full max-w-xl bg-[#0f172a] border border-white/8 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Header image area */}
        <div
          className="h-44 w-full relative overflow-hidden"
          style={{ backgroundColor: course.color + '22' }}
        >
          {course.thumbnail ? (
            <img src={course.thumbnail} alt={course.name} className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={56} style={{ color: course.color }} className="opacity-15" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent" />
          <div className="absolute top-5 left-6">
            <span className="px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-black tracking-[0.2em] text-white uppercase border border-white/10">
              {course.code}
            </span>
          </div>
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full text-slate-400 hover:text-white transition-all border border-white/10"
          >
            <X size={16} />
          </button>
          {isEnrolled && (
            <div className="absolute bottom-4 right-5">
              <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Enrolled</span>
              </div>
            </div>
          )}
          {isPending && !isEnrolled && (
            <div className="absolute bottom-4 right-5">
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-full">
                <Clock size={12} className="text-amber-400" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Pending</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-8">
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">{course.name}</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">{course.description}</p>

          <div className="flex flex-wrap gap-4 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-emerald-500" />
              <span>{course.studentsCount ?? 0} students</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-600" />
              <span>{course.term}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{course.instructorName}</span>
            </div>
          </div>

          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {tagList.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={onEnroll}
            disabled={isEnrolled || isEnrolling || isPending}
            className={cn(
              "w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl",
              isEnrolled
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : isPending
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20"
            )}
          >
            {isEnrolling ? 'Requesting...' : isEnrolled ? 'Already Enrolled' : isPending ? '⏳ Pending Approval' : 'Request to Join'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Discovery Card ────────────────────────────────────────────────────────────
const DiscoveryCard: React.FC<{
  course: Course;
  index: number;
  isEnrolled: boolean;
  isPending: boolean;
  onEnroll: () => void;
  onDetail: () => void;
}> = ({ course, index, isEnrolled, isPending, onEnroll, onDetail }) => {
  const tagList = course.tags ? course.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-[#1e293b]/40 border border-white/5 rounded-[2rem] overflow-hidden hover:border-emerald-500/25 transition-all hover:shadow-[0_16px_40px_-16px_rgba(0,229,160,0.12)] flex flex-col cursor-pointer"
      onClick={onDetail}
    >
      {/* Thumbnail */}
      <div
        className="h-40 w-full relative overflow-hidden"
        style={{ backgroundColor: course.color + '15' }}
      >
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-60" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={40} style={{ color: course.color }} className="opacity-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent opacity-70" />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full text-[9px] font-black tracking-[0.15em] text-white uppercase border border-white/10">
            {course.code}
          </span>
        </div>
        {isEnrolled && (
          <div className="absolute top-4 right-4">
            <div className="bg-emerald-500 p-1.5 rounded-full text-slate-950 shadow-lg shadow-emerald-500/40">
              <CheckCircle2 size={13} strokeWidth={3} />
            </div>
          </div>
        )}
        {isPending && !isEnrolled && (
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 px-2 py-1 rounded-full backdrop-blur-sm">
              <Clock size={10} className="text-amber-400" />
              <span className="text-[8px] font-black text-amber-400 uppercase">Pending</span>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-black text-white mb-2 group-hover:text-emerald-400 transition-colors tracking-tight leading-tight line-clamp-2">
          {course.name}
        </h3>
        <p className="text-slate-500 text-[12px] leading-relaxed line-clamp-2 mb-4 flex-1">
          {course.description}
        </p>

        {/* Tags */}
        {tagList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tagList.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-slate-800 rounded-full text-[9px] font-bold text-slate-500 uppercase tracking-wider"
              >
                #{tag}
              </span>
            ))}
            {tagList.length > 3 && (
              <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[9px] font-bold text-slate-600">+{tagList.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">
          <span>{course.instructorName}</span>
          <span>·</span>
          <span>{course.studentsCount ?? 0} students</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
          <button
            onClick={onDetail}
            className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-white/5"
          >
            View Details
          </button>
          <button
            onClick={isPending ? undefined : onEnroll}
            disabled={isEnrolled || isPending}
            className={cn(
              "flex-[1.5] py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95",
              isEnrolled
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 cursor-default"
                : isPending
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            )}
          >
            {isEnrolled ? '✓ Enrolled' : isPending ? '⏳ Pending' : 'Request to Join'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const CourseDiscoveryPage: React.FC<CourseDiscoveryPageProps> = ({
  enrolledCourseIds,
  pendingCourseIds = [],
  onEnroll,
  onBack
}) => {
  const { token } = useAuth();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState<string | null>(null);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);

  // İlk yüklemede tüm kursları çek
  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    searchCourses('', token)
      .then(setAllCourses)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  // Tüm kurslardan eşsiz tag'leri çıkar
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allCourses.forEach(c => {
      if (c.tags) {
        c.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [allCourses]);

  // Arama + tag filtresi (client-side, anlık)
  const filteredCourses = useMemo(() => {
    let results = allCourses;
    const q = query.trim().toLowerCase();
    if (q) {
      results = results.filter(c => {
        const searchable = `${c.name} ${c.code} ${c.description} ${c.tags || ''} ${c.instructorName}`.toLowerCase();
        return q.split(' ').every(word => searchable.includes(word));
      });
    }
    if (activeTag) {
      results = results.filter(c =>
        c.tags?.split(',').map(t => t.trim()).includes(activeTag)
      );
    }
    return results;
  }, [allCourses, query, activeTag]);

  const handleEnrollClick = async (courseId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsEnrolling(courseId);
    try {
      await onEnroll(courseId);
    } catch (err) {
      console.error('Enroll failed:', err);
      alert('Enrollment failed. Please try again.');
    } finally {
      setIsEnrolling(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] p-6 lg:p-12 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-[1600px] mx-auto">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-white mb-10 text-[11px] font-black uppercase tracking-widest transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
          Back to My Courses
        </button>

        {/* Header */}
        <div className="mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-3"
          >
            Discover <span className="text-emerald-500">Knowledge</span>
          </motion.h1>
          <p className="text-slate-400 font-medium">
            Explore all active courses. Search by name, code, or tag.
          </p>
        </div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative w-full mb-6"
        >
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course name, code or topic... (e.g. Python, AI, CMPE)"
            className="block w-full pl-14 pr-6 py-5 bg-[#1e293b]/40 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-600 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </motion.div>

        {/* Tag Chips */}
        {allTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-2 mb-10"
          >
            <button
              onClick={() => setActiveTag(null)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border",
                activeTag === null
                  ? "bg-emerald-500 text-slate-950 border-emerald-500"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600 hover:text-slate-300"
              )}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border",
                  activeTag === tag
                    ? "bg-emerald-500 text-slate-950 border-emerald-500"
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600 hover:text-slate-300"
                )}
              >
                <Tag size={10} />
                {tag}
              </button>
            ))}
          </motion.div>
        )}

        {/* Results count */}
        {!isLoading && (
          <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-6">
            {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Course Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen size={48} className="mx-auto mb-4 opacity-15 text-slate-400" />
            <p className="text-slate-500 font-bold">No courses match your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCourses.map((course, index) => {
              // Primary: use enrollmentStatus from the search result (most accurate)
              // Fallback: use prop arrays (for instant UI before search loads)
              const enrolledStatus = course.enrollmentStatus;
              const isEnrolled = enrolledStatus === 'active' || enrolledCourseIds.includes(course.id);
              const isPending  = !isEnrolled && (enrolledStatus === 'pending' || pendingCourseIds.includes(course.id));
              return (
                <DiscoveryCard
                  key={course.id}
                  course={course}
                  index={index}
                  isEnrolled={isEnrolled}
                  isPending={isPending}
                  onEnroll={() => handleEnrollClick(course.id)}
                  onDetail={() => setDetailCourse(course)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {detailCourse && (
          <CourseDetailModal
            course={detailCourse}
            isEnrolled={detailCourse.enrollmentStatus === 'active' || enrolledCourseIds.includes(detailCourse.id)}
            isPending={detailCourse.enrollmentStatus === 'pending' || (!enrolledCourseIds.includes(detailCourse.id) && pendingCourseIds.includes(detailCourse.id))}
            isEnrolling={isEnrolling === detailCourse.id}
            onEnroll={() => handleEnrollClick(detailCourse.id)}
            onClose={() => setDetailCourse(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
