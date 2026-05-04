import React, { useState } from 'react';
import { LogIn, UserPlus, Bot, Terminal, Loader2, GraduationCap, BookOpen, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onLogin: () => void;
}

type Mode = 'login' | 'register';
type RegisterRole = 'student' | 'instructor';

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { login, register, isLoading, error } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [localError, setLocalError] = useState<string | null>(null);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState<RegisterRole>('student');

  const displayError = localError || error;

  const switchMode = (m: Mode) => {
    setMode(m);
    setLocalError(null);
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
      onLogin();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (regPassword !== regConfirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    try {
      await register({
        email: regEmail,
        password: regPassword,
        first_name: regFirstName,
        last_name: regLastName,
        role: regRole,
      });
      onLogin();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  const inputCls = "w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-slate-800 outline-none transition-all placeholder:text-slate-600 text-slate-200";

  return (
    <div className="min-h-screen bg-[#0f172a] flex overflow-hidden relative">
      {/* Left Side: Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 z-10 bg-[#0f172a] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full mx-auto"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <img src="/thinkcode_logo.png" alt="ThinkCode Logo" className="h-10 w-auto object-contain shrink-0" />
            <div className="leading-none">
              <span className="text-[18px] font-light text-slate-300 tracking-tight">Think</span>
              <span className="text-[18px] font-bold text-emerald-400 tracking-tight">Code</span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-8">
            <button
              onClick={() => switchMode('login')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                mode === 'login'
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <LogIn size={15} />
              Sign In
            </button>
            <button
              onClick={() => switchMode('register')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                mode === 'register'
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <UserPlus size={15} />
              Register
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* ── LOGIN FORM ── */}
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome back</h1>
                  <p className="text-slate-400 text-sm font-medium">Sign in to continue your learning journey.</p>
                </div>

                <form className="space-y-5" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                      type="email" placeholder="name@example.com" value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={inputCls} required autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                    <input
                      type="password" placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={inputCls} required autoComplete="current-password"
                    />
                  </div>

                  {displayError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 font-medium">
                      {displayError}
                    </motion.div>
                  )}

                  <button
                    type="submit" disabled={isLoading}
                    className={cn(
                      "w-full bg-emerald-500 text-slate-950 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-3",
                      isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-emerald-400"
                    )}
                  >
                    {isLoading ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : <><LogIn size={18} /> Sign In</>}
                  </button>
                </form>

                {/* Demo accounts */}
                <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Demo Accounts</p>
                  <button onClick={() => { setEmail('instructor@thinkcode.edu'); setPassword('Instructor123!'); }}
                    className="block text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium">
                    Instructor — instructor@thinkcode.edu / Instructor123!
                  </button>
                  <div className="border-t border-slate-800/60 my-2" />
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">CMPE211 — Algorithms</p>
                  <button onClick={() => { setEmail('emma.johnson@thinkcode.edu'); setPassword('Student123!'); }}
                    className="block text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium">
                    Student1 — emma.johnson@thinkcode.edu / Student123!
                  </button>
                  <div className="border-t border-slate-800/60 my-2" />
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">CS204 — Systems Programming</p>
                  <button onClick={() => { setEmail('emma.flores@thinkcode.edu'); setPassword('Student123!'); }}
                    className="block text-xs text-slate-400 hover:text-blue-400 transition-colors font-medium">
                    Student3 — emma.flores@thinkcode.edu / Student123!
                  </button>
                </div>

                <p className="mt-5 text-center text-sm text-slate-500">
                  Don't have an account?{' '}
                  <button onClick={() => switchMode('register')} className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                    Create one <ChevronRight size={12} className="inline" />
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── REGISTER FORM ── */}
            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Create account</h1>
                  <p className="text-slate-400 text-sm font-medium">Join ThinkCode as a student or instructor.</p>
                </div>

                {/* Role Selector */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setRegRole('student')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      regRole === 'student'
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-600"
                    )}
                  >
                    <GraduationCap size={22} />
                    <span className="text-xs font-bold uppercase tracking-wider">Student</span>
                    <span className="text-[10px] text-slate-500 text-center leading-tight">Solve problems &amp; track progress</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole('instructor')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                      regRole === 'instructor'
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-600"
                    )}
                  >
                    <BookOpen size={22} />
                    <span className="text-xs font-bold uppercase tracking-wider">Instructor</span>
                    <span className="text-[10px] text-slate-500 text-center leading-tight">Create courses &amp; design flows</span>
                  </button>
                </div>

                <form className="space-y-4" onSubmit={handleRegister}>
                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">First Name</label>
                      <input
                        type="text" placeholder="Ada" value={regFirstName}
                        onChange={e => setRegFirstName(e.target.value)}
                        className={inputCls} required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Last Name</label>
                      <input
                        type="text" placeholder="Lovelace" value={regLastName}
                        onChange={e => setRegLastName(e.target.value)}
                        className={inputCls} required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                      type="email" placeholder="name@example.com" value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className={inputCls} required autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                    <input
                      type="password" placeholder="Min. 6 characters" value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      className={inputCls} required autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Password</label>
                    <input
                      type="password" placeholder="Repeat password" value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      className={cn(inputCls, regConfirm && regPassword !== regConfirm ? "border-red-500/60 focus:ring-red-500" : "")}
                      required autoComplete="new-password"
                    />
                    {regConfirm && regPassword !== regConfirm && (
                      <p className="text-xs text-red-400 ml-1">Passwords don't match</p>
                    )}
                  </div>

                  {displayError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 font-medium">
                      {displayError}
                    </motion.div>
                  )}

                  <button
                    type="submit" disabled={isLoading}
                    className={cn(
                      "w-full bg-emerald-500 text-slate-950 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-3 mt-2",
                      isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-emerald-400"
                    )}
                  >
                    {isLoading
                      ? <><Loader2 size={18} className="animate-spin" /> Creating account...</>
                      : <><UserPlus size={18} /> Create {regRole === 'instructor' ? 'Instructor' : 'Student'} Account</>
                    }
                  </button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-500">
                  Already have an account?{' '}
                  <button onClick={() => switchMode('login')} className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                    Sign in <ChevronRight size={12} className="inline" />
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Right Side: Branding */}
      <div className="hidden lg:flex flex-1 bg-[#0d1117] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-lg text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full shadow-sm border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Platform Status: Online</span>
          </div>
          <h2 className="text-5xl font-bold text-white tracking-tight leading-tight mb-6">
            Where <span className="text-emerald-500 italic font-serif">teaching</span> meets intelligent learning.
          </h2>
          <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10">
            A classroom platform for students and instructors — with adaptive pedagogical flows, AI-powered hints, and real learning analytics.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800 text-left">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4">
                <Bot size={20} />
              </div>
              <h3 className="font-bold text-white mb-1">AI Tutor</h3>
              <p className="text-xs text-slate-500 font-medium">Guided hints that build understanding, not dependency.</p>
            </div>
            <div className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800 text-left">
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 mb-4">
                <Terminal size={20} />
              </div>
              <h3 className="font-bold text-white mb-1">Adaptive Flows</h3>
              <p className="text-xs text-slate-500 font-medium">Evidence-based paths tailored to each student's progress.</p>
            </div>
          </div>
        </motion.div>

        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full blur-[120px] opacity-10" />
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-emerald-500 rounded-full blur-[120px] opacity-10" />
      </div>

      {/* Dakik Yazılım Teknolojileri — sağ alt köşe */}
      <div className="fixed bottom-5 right-5 flex flex-col items-end gap-1.5 select-none z-50">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Powered by</span>
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/15 transition-all duration-300">
          <img src="/dakikyazilim_logo.jpeg" alt="Dakik Yazılım Teknolojileri" title="Dakik Yazılım Teknolojileri" className="h-10 w-auto" />
        </div>
      </div>
    </div>
  );
};
