import React, { useState } from 'react';
import type { Task } from '../services/gemini';
import { Calendar, Sparkles, ExternalLink, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onReshuffle: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, onToggleComplete, onReshuffle }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const getUrgencyBadgeColor = (urgency: Task['urgency']) => {
    switch (urgency) {
      case 'high': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'low': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getCategoryColor = (category: Task['category']) => {
    switch (category) {
      case 'work': return 'text-cyan-400';
      case 'study': return 'text-purple-400';
      case 'personal': return 'text-pink-400';
    }
  };

  return (
    <div className="glass-panel p-6 flex flex-col h-full relative overflow-hidden">
      {/* Visual Accent Bar */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-white font-bold text-lg font-heading tracking-wide">
            Autonomous Task Board
          </h3>
          <p className="text-xs text-slate-400">
            Click tasks to expand AI outline and resources.
          </p>
        </div>
        
        <button
          onClick={onReshuffle}
          className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 text-xs font-semibold shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all active:scale-95"
        >
          <Sparkles size={13} />
          <span>Reshuffle Schedule</span>
        </button>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[380px]">
        <AnimatePresence>
          {tasks.length === 0 ? (
            <div className="text-center text-slate-500 py-12 text-sm font-medium">
              No tasks active. Ask Aura to schedule your goals!
            </div>
          ) : (
            tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  task.completed 
                    ? 'bg-zinc-950/20 border-zinc-900/40 opacity-50' 
                    : selectedTask?.id === task.id
                    ? 'bg-purple-950/15 border-purple-500/40 glow-card-active' 
                    : 'bg-zinc-900/20 border-white/5 hover:border-white/10 hover:bg-zinc-900/30'
                }`}
                onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
              >
                <div className="flex items-start gap-4">
                  {/* Task complete checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete(task.id);
                    }}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      task.completed 
                        ? 'bg-purple-600 border-purple-500 text-white' 
                        : 'border-white/20 hover:border-purple-400/60 bg-white/5'
                    }`}
                  >
                    {task.completed && <Check size={12} strokeWidth={3} />}
                  </button>
                  
                  {/* Task details */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold tracking-wide text-white transition-all ${
                      task.completed ? 'line-through text-slate-500' : ''
                    }`}>
                      {task.title}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs">
                      <span className={`capitalize text-[9px] font-extrabold px-2 py-0.5 rounded border ${getUrgencyBadgeColor(task.urgency)}`}>
                        {task.urgency}
                      </span>
                      <span className={`font-bold capitalize ${getCategoryColor(task.category)}`}>
                        {task.category}
                      </span>
                      {task.scheduledTime && (
                        <span className="text-slate-400 flex items-center gap-1 font-medium">
                          <Calendar size={11} className="text-slate-500" />
                          {task.scheduledTime}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight 
                    size={16} 
                    className={`text-slate-500 transition-transform ${selectedTask?.id === task.id ? 'rotate-90' : ''}`} 
                  />
                </div>

                {/* Extended details panel */}
                {selectedTask?.id === task.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-300 space-y-3"
                  >
                    {task.studyGuide && (
                      <div>
                        <div className="font-bold text-purple-400 mb-1.5 flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>AI Execution Plan</span>
                        </div>
                        <pre className="font-sans whitespace-pre-wrap leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5">
                          {task.studyGuide}
                        </pre>
                      </div>
                    )}

                    {/* Specific Action Portal (e.g. paying bill or starting project) */}
                    {task.title.toLowerCase().includes('pay') && (
                      <a 
                        href="#pay"
                        onClick={(e) => { e.preventDefault(); alert("Redirecting securely to mock payment client..."); }}
                        className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-green-950/40 border border-green-500/30 hover:border-green-400 text-green-300 font-bold w-full transition-all active:scale-95"
                      >
                        <span>Open Bill Payment Portal</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
export default TaskList;
