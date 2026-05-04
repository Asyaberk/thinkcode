import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Award, Download, Share2, X, Star, CheckCircle2, BookOpen } from 'lucide-react';
import { Course } from '../types';
import { cn } from '../lib/utils';

interface CourseCompletionModalProps {
  course: Course;
  onClose: () => void;
}

export const CourseCompletionModal: React.FC<CourseCompletionModalProps> = ({ course, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        className="relative w-full max-w-4xl bg-[#0f172a] rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden"
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500 rounded-full blur-[120px]" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 p-8 md:p-12">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
                T
              </div>
              <span className="text-sm font-black text-white uppercase tracking-widest">ThinkCode Academy</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
            {/* Left Column: Visuals */}
            <div className="lg:col-span-2 space-y-8">
              <div className="relative">
                <motion.div
                  initial={{ rotate: -5, scale: 0.9 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                  className="aspect-[3/4] bg-white rounded-2xl shadow-2xl overflow-hidden relative group"
                >
                  {course.certificateImage ? (
                    <img 
                      src={course.certificateImage} 
                      alt="Certificate" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-6 flex flex-col items-center justify-between text-slate-900 relative">
                      {/* Certificate Design */}
                      <div className="absolute inset-0 border-[12px] border-slate-50 opacity-50 pointer-events-none" />
                      <div className="absolute inset-4 border border-slate-200 pointer-events-none" />
                      
                      <div className="text-center mt-4">
                        <Award className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Certificate of Completion</h3>
                        <div className="h-px w-8 bg-slate-300 mx-auto" />
                      </div>

                      <div className="text-center px-4">
                        <p className="text-[8px] italic text-slate-500 mb-2">This is to certify that the student</p>
                        <div className="text-lg font-serif font-bold text-slate-900 border-b border-slate-200 mb-4 pb-2">Student Name</div>
                        <p className="text-[8px] text-slate-500 leading-relaxed uppercase tracking-widest">
                          Has successfully completed the comprehensive course
                        </p>
                        <div className="mt-2 text-sm font-black text-emerald-600 uppercase tracking-tight leading-tight">
                          {course.name}
                        </div>
                      </div>

                      <div className="w-full flex justify-between items-end px-4 mb-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-12 h-12 rounded-full border-4 border-emerald-100 flex items-center justify-center italic text-emerald-800 text-[10px] font-bold">Seal</div>
                          <span className="text-[6px] font-bold text-slate-400">AUTHENTIC</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <img src="https://api.dicebear.com/7.x/identicon/svg?seed=sig" alt="signature" className="w-12 h-4 opacity-50" />
                          <div className="h-px w-16 bg-slate-200 mt-1" />
                          <span className="text-[6px] font-bold text-slate-400 mt-1 uppercase">Instructor Signature</span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
                
                {/* Floating Medals */}
                <motion.div
                   animate={{ y: [0, -10, 0] }}
                   transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                   className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-white shadow-xl"
                >
                  <Star fill="currentColor" size={24} />
                </motion.div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 bg-white text-slate-950 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-white/5">
                  <Download size={16} />
                  Download PDF
                </button>
                <button className="w-14 bg-white/5 text-white rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/5">
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            {/* Right Column: Summary */}
            <div className="lg:col-span-3 space-y-8">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 mb-4"
                >
                  <Trophy size={12} />
                  Course Accomplished
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                  Outstanding Work.
                </h1>
                <p className="text-slate-400 font-medium leading-relaxed max-w-md">
                  You have mastered <span className="text-white">{course.name}</span>. This journey involved solving dozens of complex problems and engaging with the Socratic AI tutor.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                  <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Knowledge Mastered</div>
                  <div className="text-2xl font-bold text-white">Full Syllabus</div>
                  <div className="mt-3 flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill="currentColor" className="text-yellow-500" />)}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                  <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Effort</div>
                  <div className="text-2xl font-bold text-white">40+ Hours</div>
                  <div className="mt-3 text-[10px] font-bold text-slate-500">Intensive learning</div>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-3xl">
                <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Skills Certified
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['Problem Solving', 'C++ Mastery', 'Algorithmic Thinking', 'Memory Management', 'System Design'].map(skill => (
                    <span key={skill} className="px-4 py-2 bg-slate-900 rounded-xl text-[10px] font-bold text-slate-300 border border-slate-800">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <button 
                  onClick={onClose}
                  className="px-8 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl text-[11px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                 >
                   Back to Dashboard
                 </button>
                 <button className="px-8 py-4 bg-white/5 border border-white/5 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all">
                    View Other Courses
                 </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
