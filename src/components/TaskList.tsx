import React, { useState } from 'react';
import type { Task } from '../services/gemini';
import { CheckCircle, Circle, Calendar, Sparkles, ExternalLink } from 'lucide-react';
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
      case 'work': return 'text-blue-400';
      case 'study': return 'text-purple-400';
      case 'personal': return 'text-pink-400';
    }
  };

  return (
    <div className="glass-panel p-6 flex flex-col h-full relative overflow-hidden">
      {/* Absolute top decoration */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold text-lg font-heading tracking-wide">
            Autonomous Task Board
          </h3>
          <p className="text-xs text-slate-400">
            Aura schedules and designs actionable outlines for you.
          </p>
        </div>
        <button
          onClick={onReshuffle}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 text-xs font-semibold shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all"
        >
          <Sparkles size={13} />
          <span>Reshuffle</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[380px]">
        <AnimatePresence>
          {tasks.length === 0 ? (
            <div className="text-center text-slate-500 py-12 text-sm">
              No tasks active. Prompt Aura to schedule something!
            </div>
          ) : (
            tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  task.completed 
                    ? 'bg-zinc-950/20 border-zinc-900 opacity-60' 
                    : selectedTask?.id === task.id
                    ? 'bg-purple-950/15 border-purple-500/40 glow-card-active' 
                    : 'bg-zinc-900/30 border-white/5 hover:border-white/10 hover:bg-zinc-900/40'
                }`}
                onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleComplete(task.id);
                    }}
                    className="mt-0.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle size={18} className="text-purple-400 fill-purple-400/10" />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold tracking-wide text-white truncate ${task.completed ? 'line-through text-slate-500' : ''}`}>
                      {task.title}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className={`capitalize text-[10px] font-bold px-2 py-0.5 rounded ${getUrgencyBadgeColor(task.urgency)}`}>
                        {task.urgency}
                      </span>
                      <span className={`font-semibold capitalize ${getCategoryColor(task.category)}`}>
                        {task.category}
                      </span>
                      {task.scheduledTime && (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Calendar size={11} />
                          {task.scheduledTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Actionable Outline/Study Guide */}
                {selectedTask?.id === task.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-300 space-y-3"
                  >
                    {task.studyGuide && (
                      <div>
                        <div className="font-semibold text-purple-400 mb-1 flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>AI Preparation Steps</span>
                        </div>
                        <pre className="font-sans whitespace-pre-wrap leading-relaxed bg-zinc-950/50 p-3 rounded-lg border border-white/5">
                          {task.studyGuide}
                        </pre>
                      </div>
                    )}

                    {/* Specific Action Portal (e.g. paying bill or starting project) */}
                    {task.title.toLowerCase().includes('pay') && (
                      <a 
                        href="#pay"
                        onClick={(e) => { e.preventDefault(); alert("Proceeding to secure simulated portal..."); }}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-green-950/40 border border-green-500/30 hover:border-green-400 text-green-300 font-semibold w-full transition-all"
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
