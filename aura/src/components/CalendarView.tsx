import React from 'react';
import type { Task } from '../services/gemini';
import { Clock, Calendar } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks }) => {
  // Extract only scheduled tasks
  const scheduledTasks = tasks.filter(t => t.scheduledTime && !t.completed);

  // Simple mock hours list
  const hours = [
    { label: '09:00 AM', time: '9:00' },
    { label: '11:00 AM', time: '11:00' },
    { label: '01:00 PM', time: '13:00' },
    { label: '03:00 PM', time: '15:00' },
    { label: '05:00 PM', time: '17:00' },
    { label: '07:00 PM', time: '19:00' },
  ];

  return (
    <div className="glass-panel p-6 flex flex-col h-full relative overflow-hidden">
      {/* Absolute top decoration */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-pink-500/30 to-transparent" />

      <h3 className="text-white font-semibold text-lg font-heading tracking-wide mb-1 flex items-center gap-2">
        <Calendar size={18} className="text-pink-400" />
        <span>Aura Timeline</span>
      </h3>
      <p className="text-xs text-slate-400 mb-6">
        Visual schedule mapped out to optimize your daily cognitive flow.
      </p>

      {/* Visual Schedule Board */}
      <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px]">
        {hours.map((hour) => {
          // Find if any task matches this general time block
          const matchingTask = scheduledTasks.find(t => {
            const timeStr = t.scheduledTime?.toLowerCase() || '';
            // Check matching hours
            if (hour.label.includes('03:00 PM') && timeStr.includes('3:00 pm')) return true;
            if (hour.label.includes('05:00 PM') && timeStr.includes('5:00 pm')) return true;
            if (hour.label.includes('07:00 PM') && timeStr.includes('7:00 pm')) return true;
            if (hour.label.includes('06:00 PM') && timeStr.includes('6:00 pm')) return true;
            return false;
          });

          return (
            <div key={hour.label} className="flex gap-4 items-start group">
              <div className="text-xs font-semibold text-slate-500 w-16 pt-1 text-right tabular-nums group-hover:text-slate-400 transition-colors">
                {hour.label}
              </div>
              
              <div className="flex-1 relative pb-4 border-l border-white/5 pl-4">
                {/* Timeline node */}
                <div className={`absolute -left-[4.5px] top-2.5 w-2 h-2 rounded-full border transition-all ${
                  matchingTask 
                    ? 'bg-pink-500 border-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.5)]' 
                    : 'bg-zinc-800 border-zinc-700'
                }`} />

                {matchingTask ? (
                  <div className="p-3 rounded-xl bg-pink-950/15 border border-pink-500/20 shadow-[0_4px_20px_rgba(236,72,153,0.05)] transition-all hover:border-pink-500/30">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white tracking-wide">
                        {matchingTask.title}
                      </h4>
                      <span className="text-[10px] font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded flex items-center gap-0.5">
                        <Clock size={9} />
                        {matchingTask.duration}
                      </span>
                    </div>
                    {matchingTask.scheduledTime && (
                      <div className="text-[10px] text-pink-300/70 mt-1 font-medium">
                        {matchingTask.scheduledTime}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-2.5 text-xs text-slate-600 font-medium italic select-none">
                    Free Focus Block
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default CalendarView;
