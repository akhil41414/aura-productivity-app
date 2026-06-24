import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuraOrb } from './components/AuraOrb';
import { FocusTimer } from './components/FocusTimer';
import { TaskList } from './components/TaskList';
import { CalendarView } from './components/CalendarView';
import { processAuraCommand, type Task } from './services/gemini';
import { Sparkles, Send, Key, X, Lock, Mail, User, ShieldCheck } from 'lucide-react';

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Review Vibe2Ship Problem Statements',
    dueDate: 'Today 3:00 PM',
    duration: '30 mins',
    urgency: 'high',
    category: 'study',
    completed: true,
    scheduledTime: 'Today 2:00 PM - 2:30 PM',
    studyGuide: '• Open official hackathon guide PDF\n• Read problem statements & evaluation matrix\n• Align team focus areas.'
  },
  {
    id: 'task-2',
    title: 'Initialize Aura Core Prototype',
    dueDate: 'Today 6:00 PM',
    duration: '2 hours',
    urgency: 'high',
    category: 'work',
    completed: false,
    scheduledTime: 'Today 3:00 PM - 5:00 PM',
    studyGuide: '• Scaffolding Vite React TS project\n• Build glassmorphic UI layout\n• Integrate Web Audio API focus states.'
  },
  {
    id: 'task-3',
    title: 'Prepare Project Submission Pitch',
    dueDate: 'Tomorrow',
    duration: '1 hour',
    urgency: 'medium',
    category: 'study',
    completed: false,
    scheduledTime: 'Today 7:00 PM - 8:00 PM',
    studyGuide: '• Outline Problem Statement selected\n• Detail features, technical stack used\n• Describe Google technologies utilization.'
  }
];

export const App: React.FC = () => {
  // Auth states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('aura_logged_in') === 'true';
  });
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // App core states
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('aura_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });
  
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('aura_gemini_key') || '';
  });

  const [inputCommand, setInputCommand] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'aura'; text: string }[]>([
    { sender: 'aura', text: "Hello. I am Aura. Type a command like 'Add a math test due Friday' and I will automatically structure sub-tasks, schedule it, and design a learning outline." }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('aura_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleToggleComplete = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleReshuffle = () => {
    setIsThinking(true);
    setChatLog(prev => [...prev, { sender: 'aura', text: "Analyzing timeline conflicts... Reshuffling incomplete tasks to optimize free blocks." }]);
    
    setTimeout(() => {
      setTasks(prev => prev.map(t => {
        if (!t.completed && t.id === 'task-2') {
          return { ...t, scheduledTime: 'Today 5:00 PM - 7:00 PM' };
        }
        return t;
      }));
      setIsThinking(false);
      setChatLog(prev => [...prev, { sender: 'aura', text: "Schedule reshuffled! Moved 'Initialize Aura Core Prototype' to 5:00 PM to accommodate your flow." }]);
    }, 1500);
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;

    const userText = inputCommand;
    setInputCommand('');
    setChatLog(prev => [...prev, { sender: 'user', text: userText }]);
    setIsThinking(true);

    try {
      const response = await processAuraCommand(userText, apiKey);
      
      setChatLog(prev => [...prev, { sender: 'aura', text: response.reply }]);
      if (response.newTasks.length > 0) {
        setTasks(prev => [...response.newTasks, ...prev]);
      }
    } catch (err) {
      console.error(err);
      setChatLog(prev => [...prev, { sender: 'aura', text: "Something went wrong. Let me try compiling that task structure again." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail || !authPassword || (authMode === 'signup' && !authName)) {
      setAuthError('Please fill out all fields.');
      return;
    }

    // Handle mock login/signup
    setIsLoggedIn(true);
    localStorage.setItem('aura_logged_in', 'true');
    if (authMode === 'signup') {
      localStorage.setItem('aura_username', authName);
      setChatLog([
        { sender: 'aura', text: `Welcome to Aura, ${authName}! I have configured your local dashboard. Ask me to schedule your tasks to begin.` }
      ]);
    } else {
      const savedName = localStorage.getItem('aura_username') || 'User';
      setChatLog([
        { sender: 'aura', text: `Welcome back, ${savedName}. Your timeline is currently optimized. How can I assist you today?` }
      ]);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('aura_logged_in');
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('aura_gemini_key', key);
    setShowKeyModal(false);
  };

  return (
    <div className={`relative min-h-screen ${isFocused ? 'focus-active-aura' : ''}`}>
      {/* Liquid background */}
      <div className="aura-container">
        <div className="aura-blob aura-blob-cyan" />
        <div className="aura-blob aura-blob-pink" />
        <div className="aura-blob aura-blob-purple" />
      </div>

      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          /* LOGIN / SIGNUP SCREEN */
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="glass-panel p-8 max-w-md w-full relative border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.15)]">
              {/* Top Accent */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                  <Sparkles size={24} className="text-white" />
                </div>
                <h1 className="font-heading font-extrabold text-3xl tracking-[0.2em] bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  AURA
                </h1>
                <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide">
                  Autonomous AI Productivity Companion
                </p>
              </div>

              {authError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs font-semibold text-center">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'signup' && (
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 text-slate-500" size={16} />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full pl-12"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-slate-500" size={16} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full pl-12"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-500" size={16} />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full pl-12"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(139,92,246,0.3)] text-sm"
                >
                  {authMode === 'login' ? 'Sign In to Aura' : 'Create Account'}
                </button>
              </form>

              {/* Developer Bypass Option */}
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2 items-center">
                <button
                  onClick={() => {
                    setIsLoggedIn(true);
                    localStorage.setItem('aura_logged_in', 'true');
                    localStorage.setItem('aura_username', 'Developer');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <ShieldCheck size={14} className="text-purple-400" />
                  <span>Bypass Authentication (Demo Mode)</span>
                </button>

                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold mt-2 transition-all"
                >
                  {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* MAIN APPLICATION DASHBOARD */
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col min-h-screen"
          >
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <span className="font-heading font-extrabold text-xl tracking-[0.15em] bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    AURA
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    {apiKey ? 'Google AI Studio Active' : 'Sandbox Demo Mode'}
                  </span>

                  {/* AI Config */}
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-950/60 border border-white/10 text-slate-200 hover:text-white hover:border-white/20 text-xs font-semibold transition-all shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                  >
                    <Key size={14} />
                    <span className="hidden sm:inline">Configure AI</span>
                  </button>

                  {/* Sign Out */}
                  <button
                    onClick={handleLogout}
                    className="py-2.5 px-4 rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 hover:bg-red-900/20 text-xs font-semibold transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </header>

            {/* Grid */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                
                {/* Left: Aura Chat */}
                <div className="lg:col-span-5 flex">
                  <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between w-full">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <AuraOrb isThinking={isThinking} isFocused={isFocused} />
                        <h2 className="text-center font-heading font-bold text-2xl text-white tracking-wide mt-2">
                          Aura Core
                        </h2>
                        <p className="text-center text-xs text-slate-400 max-w-xs mx-auto mt-1">
                          Autonomous AI schedule execution engine.
                        </p>
                      </div>

                      {/* Chat log */}
                      <div className="my-6 border border-white/5 bg-black/30 rounded-2xl p-4 h-56 overflow-y-auto space-y-4 scrollbar">
                        {chatLog.map((log, idx) => (
                          <div 
                            key={idx} 
                            className={`flex ${log.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[85%] text-xs px-4 py-3 rounded-2xl leading-relaxed ${
                                log.sender === 'user'
                                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-[0_4px_15px_rgba(139,92,246,0.25)]'
                                  : 'bg-zinc-900/60 border border-white/5 text-slate-200'
                              }`}
                            >
                              {log.text}
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleSendCommand} className="flex gap-2">
                      <input
                        type="text"
                        value={inputCommand}
                        onChange={(e) => setInputCommand(e.target.value)}
                        placeholder="Ask Aura to organize a task..."
                        className="flex-1 min-w-0"
                        disabled={isThinking}
                      />
                      <button
                        type="submit"
                        disabled={isThinking}
                        className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right: Productivity Modules */}
                <div className="lg:col-span-7 space-y-8 flex flex-col justify-between">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                    <div className="flex">
                      <FocusTimer isFocused={isFocused} onFocusChange={setIsFocused} />
                    </div>
                    <div className="flex">
                      <CalendarView tasks={tasks} />
                    </div>
                  </div>

                  <div className="flex-1 flex">
                    <div className="w-full">
                      <TaskList 
                        tasks={tasks} 
                        onToggleComplete={handleToggleComplete}
                        onReshuffle={handleReshuffle}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 max-w-md w-full relative border border-white/10"
            >
              <button
                onClick={() => setShowKeyModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>

              <h3 className="font-heading font-bold text-lg text-white mb-2 flex items-center gap-2">
                <Key size={18} className="text-purple-400" />
                <span>Configure Google AI Studio</span>
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Paste your Google AI Studio Gemini API key below to unlock actual live AI response processing. Leave empty to use Sandbox Demo mode.
              </p>

              <div className="space-y-4">
                <input
                  type="password"
                  defaultValue={apiKey}
                  placeholder="AI Studio API Key (AIzaSy...)"
                  className="w-full"
                  id="api-key-input"
                />
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      const input = document.getElementById('api-key-input') as HTMLInputElement;
                      saveApiKey(input?.value || '');
                    }}
                    className="py-2.5 px-5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 text-sm transition-all active:scale-95 shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
                  >
                    Save & Initialize
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default App;
