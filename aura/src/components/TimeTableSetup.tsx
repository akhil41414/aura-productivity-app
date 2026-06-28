import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Plus, Trash2, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';


interface CustomQA {
  question: string;
  answer: string;
}

export interface UserScheduleProfile {
  role: 'student' | 'employee' | 'other';
  schoolTimingsStart: string;
  schoolTimingsEnd: string;
  hasTuition: boolean;
  tuitionTimingsStart: string;
  tuitionTimingsEnd: string;
  weekendLeisureHours: number;
  customQA: CustomQA[];
}

interface TimeTableSetupProps {
  onSaveProfile: (profile: UserScheduleProfile) => void;
  savedProfile?: UserScheduleProfile | null;
}

export const TimeTableSetup: React.FC<TimeTableSetupProps> = ({ onSaveProfile, savedProfile }) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'student' | 'employee' | 'other'>(savedProfile?.role || 'student');
  const [schoolStart, setSchoolStart] = useState(savedProfile?.schoolTimingsStart || '07:30');
  const [schoolEnd, setSchoolEnd] = useState(savedProfile?.schoolTimingsEnd || '15:00');
  const [hasTuition, setHasTuition] = useState(savedProfile?.hasTuition || false);
  const [tuitionStart, setTuitionStart] = useState(savedProfile?.tuitionTimingsStart || '16:00');
  const [tuitionEnd, setTuitionEnd] = useState(savedProfile?.tuitionTimingsEnd || '18:00');
  const [leisureHours, setLeisureHours] = useState(savedProfile?.weekendLeisureHours || 4);
  
  const [customQA, setCustomQA] = useState<CustomQA[]>(savedProfile?.customQA || []);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [showSavedNotification, setShowSavedNotification] = useState(false);

  const addCustomQA = () => {
    if (newQuestion.trim() && newAnswer.trim()) {
      setCustomQA(prev => [...prev, { question: newQuestion, answer: newAnswer }]);
      setNewQuestion('');
      setNewAnswer('');
    }
  };

  const deleteCustomQA = (index: number) => {
    setCustomQA(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const profile: UserScheduleProfile = {
      role,
      schoolTimingsStart: schoolStart,
      schoolTimingsEnd: schoolEnd,
      hasTuition,
      tuitionTimingsStart: tuitionStart,
      tuitionTimingsEnd: tuitionEnd,
      weekendLeisureHours: leisureHours,
      customQA
    };
    onSaveProfile(profile);
    setShowSavedNotification(true);
    setTimeout(() => setShowSavedNotification(false), 2500);
  };

  return (
    <div className="glass-panel p-6 flex flex-col min-h-[500px] justify-between relative overflow-hidden text-left">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

      {/* Save Success Alert */}
      <AnimatePresence>
        {showSavedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 inset-x-4 bg-green-950/80 border border-green-500/40 rounded-xl p-3 flex items-center gap-2.5 z-20"
          >
            <CheckCircle2 className="text-green-400 shrink-0" size={18} />
            <div className="text-xs text-green-200">
              <span className="font-bold">Schedule Saved!</span> Aura has analyzed your timetable and will reserve slots accordingly.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-white font-bold text-lg font-heading tracking-wide">
            Set Up Time Table
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Build your baseline schedule so Aura templates tasks around your busy times.
          </p>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Step 1: Define Your Daily Role
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you primarily a student, employee, or other?
              </p>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {(['student', 'employee', 'other'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3.5 rounded-xl border text-xs font-bold capitalize transition-all active:scale-95 ${
                      role === r
                        ? 'bg-purple-900/30 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                        : 'bg-zinc-950/40 border-zinc-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Step 2: Timings & Commitments
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                What are your daily occupied hours?
              </p>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                      Start Time
                    </span>
                    <input
                      type="time"
                      value={schoolStart}
                      onChange={(e) => setSchoolStart(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                      End Time
                    </span>
                    <input
                      type="time"
                      value={schoolEnd}
                      onChange={(e) => setSchoolEnd(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl text-slate-200"
                    />
                  </div>
                </div>

                <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3.5 flex gap-2.5 items-start">
                  <ShieldAlert className="text-purple-400 shrink-0 mt-0.5" size={14} />
                  <span className="text-[10px] text-slate-400 leading-relaxed">
                    Aura automatically avoids scheduling deep-work blocks between these hours, keeping your calendar conflict-free.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Step 3: Tuition & Study Groups
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                Do you attend tuition, extra classes, or regular study groups?
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setHasTuition(true)}
                  className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    hasTuition
                      ? 'bg-purple-900/30 border-purple-500/50 text-purple-300'
                      : 'bg-zinc-950/40 border-zinc-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHasTuition(false)}
                  className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    !hasTuition
                      ? 'bg-purple-900/30 border-purple-500/50 text-purple-300'
                      : 'bg-zinc-950/40 border-zinc-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  No
                </button>
              </div>

              {hasTuition && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                      Start Time
                    </span>
                    <input
                      type="time"
                      value={tuitionStart}
                      onChange={(e) => setTuitionStart(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                      End Time
                    </span>
                    <input
                      type="time"
                      value={tuitionEnd}
                      onChange={(e) => setTuitionEnd(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl text-slate-200"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Step 4: Leisure / Free Time
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                In weekends, how much time do you allocate for playing or leisure?
              </p>

              <div className="pt-2">
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={leisureHours}
                  onChange={(e) => setLeisureHours(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold mt-1.5">
                  <span>0 hrs</span>
                  <span className="text-purple-400 text-xs font-bold bg-purple-500/10 px-2 py-0.5 border border-purple-500/20 rounded-md">
                    {leisureHours} Hours Limit
                  </span>
                  <span>12 hrs</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <label className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                Step 5: Custom Questionnaire Q&A
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                Optionally add custom details about your habits (e.g. late night studying).
              </p>

              {/* Custom QA list */}
              <div className="max-h-28 overflow-y-auto space-y-2 pr-1 scrollbar">
                {customQA.map((qa, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/80 border border-white/5 text-[10px] text-slate-300 leading-relaxed">
                    <div className="truncate flex-1 pr-2">
                      <span className="font-semibold text-purple-400">Q:</span> {qa.question} <br />
                      <span className="font-semibold text-cyan-400">A:</span> {qa.answer}
                    </div>
                    <button
                      onClick={() => deleteCustomQA(i)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add form */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <input
                  type="text"
                  placeholder="Custom Question (e.g. Do you sleep early?)"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full text-xs h-9 py-1 px-3 bg-zinc-950/60 border border-zinc-800 rounded-xl"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Your Answer (e.g. Yes, sleep by 10:30 PM)"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    className="flex-1 text-xs h-9 py-1 px-3 bg-zinc-950/60 border border-zinc-800 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={addCustomQA}
                    className="p-2 h-9 w-9 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-md"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep(prev => prev - 1)}
          className="flex items-center gap-1 py-2 px-3 rounded-lg border border-white/5 bg-zinc-950/40 text-slate-400 hover:text-slate-200 text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={13} />
          <span>Back</span>
        </button>

        <span className="text-[10px] font-bold text-slate-500 tracking-wider">
          {step} / 5
        </span>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep(prev => prev + 1)}
            className="flex items-center gap-1 py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs transition-all active:scale-95"
          >
            <span>Next</span>
            <ChevronRight size={13} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            className="py-2 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold hover:opacity-95 text-xs transition-all active:scale-95 shadow-md"
          >
            Save Timetable
          </button>
        )}
      </div>
    </div>
  );
};
export default TimeTableSetup;
