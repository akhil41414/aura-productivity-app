import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuraOrb } from './components/AuraOrb';
import { FocusTimer } from './components/FocusTimer';
import { TaskList } from './components/TaskList';
import { CalendarView } from './components/CalendarView';
import { processAuraCommand, type Task } from './services/gemini';
import { 
  Sparkles, 
  Send, 
  Key, 
  X
} from 'lucide-react';

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
  
  // Aura response feedback
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'aura'; text: string }[]>([
    { sender: 'aura', text: "Hello Bajolge Tarun. I am Aura. Type a command like 'Add a math test due Friday' and I will automatically structure sub-tasks, schedule it, and design a learning outline." }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync tasks to localstorage
  useEffect(() => {
    localStorage.setItem('aura_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Scroll to bottom of chat
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
      // Shift uncompleted tasks forward in schedule
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

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('aura_gemini_key', key);
    setShowKeyModal(false);
  };

  return (
    <div className={`relative min-h-screen ${isFocused ? 'focus-active-aura' : ''}`}>
      {/* Background gradients */}
      <div className="aura-container">
        <div className="aura-blob aura-blob-cyan" />
        <div className="aura-blob aura-blob-pink" />
        <div className="aura-blob aura-blob-purple" />
      </div>

      {/* Main Glass Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-heading font-extrabold text-lg tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              AURA
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              {apiKey ? 'Google AI Studio Active' : 'Sandbox Demo Mode'}
            </span>

            {/* API Key Configure Button */}
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-300 hover:text-white hover:border-zinc-700 text-xs font-semibold transition-all"
            >
              <Key size={13} />
              <span>Configure AI Studio</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Aura Pulser & Autonomous Chat Console (Span 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between">
              {/* Top accent */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
              
              <div>
                <AuraOrb isThinking={isThinking} isFocused={isFocused} />
                
                <h2 className="text-center font-heading font-bold text-2xl text-white tracking-wide mt-2">
                  Aura Core
                </h2>
                <p className="text-center text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  Say a command like "Schedule my history essay preparation" or "Add workout session today".
                </p>
              </div>

              {/* Chat log view */}
              <div className="my-6 border border-white/5 bg-zinc-950/30 rounded-xl p-4 h-48 overflow-y-auto space-y-3 scrollbar">
                {chatLog.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${log.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] text-xs px-3.5 py-2.5 rounded-xl leading-relaxed ${
                        log.sender === 'user'
                          ? 'bg-purple-950/30 border border-purple-500/20 text-purple-200'
                          : 'bg-zinc-900/60 border border-white/5 text-slate-300'
                      }`}
                    >
                      {log.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Console */}
              <form onSubmit={handleSendCommand} className="flex gap-2">
                <input
                  type="text"
                  value={inputCommand}
                  onChange={(e) => setInputCommand(e.target.value)}
                  placeholder="Ask Aura to schedule something..."
                  className="flex-1 min-w-0"
                  disabled={isThinking}
                />
                <button
                  type="submit"
                  disabled={isThinking}
                  className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Intelligent Tasks & Schedule Layout (Span 7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Pomodoro Timer & Focus Controller */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FocusTimer isFocused={isFocused} onFocusChange={setIsFocused} />
              <CalendarView tasks={tasks} />
            </div>

            {/* Smart Task Board */}
            <TaskList 
              tasks={tasks} 
              onToggleComplete={handleToggleComplete}
              onReshuffle={handleReshuffle}
            />

          </div>
        </div>
      </main>

      {/* API Key Configurations Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 max-w-md w-full relative"
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
                    className="py-2 px-4 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 text-sm transition-all"
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
