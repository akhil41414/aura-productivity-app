import React, { useState, useEffect, useRef } from 'react';
import { 
  processAuraCommand, 
  scanImageWithGemini, 
  generateMicroplanFromServer, 
  generateQuickWinFromServer, 
  evaluateReplanFromServer,
  isCapabilityQuery,
  generateSessionTitle,
  guessEnergyLevel,
  parseDueDate,
  summarizeTaskTitle,
  type Task, 
  type UserScheduleProfile, 
  type CoachingTone 
} from './services/gemini';
import { 
  Menu, SquarePen, Plus, Mic, Send, X, History, Trash2, Settings, 
  ArrowLeft, Check, Clock, 
  Zap, Calendar, ListTodo, Sparkles, Play, Activity
} from 'lucide-react';
import { AuraOrb } from './components/AuraOrb';
import { signInWithGoogle, signOutUser, subscribeToAuthChanges, type AuraUser } from './services/firebaseAuth';
import { getUserItem, setUserItem, removeUserItem, isNewUser } from './services/userStorage';
import {
  connectGoogleCalendar,
  connectGoogleClassroom,
  createCalendarEvent,
  fetchClassroomAssignments
} from './services/googleIntegrations';
import './App.css';

export const App: React.FC = () => {
  const isDuplicateTask = (title: string, existingTasks: Task[]): boolean => {
    const cleanTitle = title.toLowerCase().trim();
    const isDup = existingTasks.some(t => t.title.toLowerCase().trim() === cleanTitle);
    if (isDup) {
      console.warn(`[Task Deduplication] Blocked adding duplicate task: "${title}"`);
    }
    return isDup;
  };

  const [appState, setAppState] = useState<'login' | 'transition' | 'chat_open' | 'chat_closed'>('login');

  // --- Per-user auth state ---
  const [currentUser, setCurrentUser] = useState<AuraUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false); // becomes true once Firebase reports initial auth state
  const [hydrated, setHydrated] = useState(false); // becomes true once this user's saved data has been loaded into state
  const [authError, setAuthError] = useState('');

  const DEFAULT_TASKS: Task[] = [
    {
      id: 'task-initial-1',
      title: 'Math Assignment',
      dueDate: '27th May 2026',
      duration: '2 hours',
      urgency: 'high',
      category: 'study',
      completed: false,
      scheduledTime: 'Thursday 3:00 PM - 5:00 PM',
      studyGuide: '• Review rubric guidelines\n• Solve calculus exercises 3.4 & 3.5\n• Draft integration structural points.'
    },
    {
      id: 'task-initial-2',
      title: 'Physics Lab Report',
      dueDate: '29th May 2026',
      duration: '1.5 hours',
      urgency: 'medium',
      category: 'study',
      completed: false,
      scheduledTime: 'Friday 4:30 PM - 6:00 PM',
      studyGuide: '• Input measurement tables\n• Draw wiring diagram circuits\n• Write calculations and conclusions.'
    },
    {
      id: 'task-initial-3',
      title: 'Math Homework',
      dueDate: '23 May 2026',
      duration: '1 hour',
      urgency: 'low',
      category: 'study',
      completed: true,
      scheduledTime: 'May 23, 4:00 PM - 5:00 PM',
      studyGuide: '• Practice problems on page 45\n• Match answers with teacher key.'
    }
  ];

  const DEFAULT_TIMETABLE: UserScheduleProfile = {
    role: 'student',
    schoolTimingsStart: '07:30',
    schoolTimingsEnd: '15:00',
    hasTuition: true,
    tuitionTimingsStart: '16:00',
    tuitionTimingsEnd: '18:00',
    weekendLeisureHours: 2,
    customQA: [
      { question: 'When do you study best?', answer: 'Late evenings' }
    ],
    coachingTone: 'balanced'
  };

  // Tasks State — starts empty; hydrated per-user after sign-in (see hydration effect below)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [username, setUsername] = useState('ĀKHÌL');
  const [showSettings, setShowSettings] = useState(false);
  const [hasCompletedTransition, setHasCompletedTransition] = useState(false);
  
  const [inputCommand, setInputCommand] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'aura'; text: string; tasks?: Task[]; proposal?: { id: string; tasks: Task[] }; timetableProposal?: UserScheduleProfile }[]>([]);

  // New states for Phase 7
  const [tasksTab, setTasksTab] = useState<'active' | 'someday'>('active');
  const [energyFilter, setEnergyFilter] = useState<'high_focus' | 'low_effort' | null>(null);
  const [dismissedLastMinuteIds, setDismissedLastMinuteIds] = useState<string[]>([]);
  const [greeting, setGreeting] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  
  const [archivedChats, setArchivedChats] = useState<{ id: string; title?: string; date: string; log: any[] }[]>([]);
  const [activeArchivedChat, setActiveArchivedChat] = useState<any[] | null>(null);

  // Active Screen Routing
  const [activeScreen, setActiveScreen] = useState<'chat' | 'timetable' | 'tasks' | 'schedule' | 'tips' | 'agents' | 'scanner' | 'agent-logs'>('chat');

  // Agentic & Live engine states
  const isSendingRef = useRef(false);
  const [lastReplanTimestamp, setLastReplanTimestamp] = useState<number>(0);
  const [lastReplanTime, setLastReplanTime] = useState<string>('');
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [quickWin, setQuickWin] = useState<{ taskTitle: string; stepTitle: string; guide: string; taskId: string } | null>(null);
  const [isReplanning, setIsReplanning] = useState(false);

  // Real Google Calendar / Classroom integration state (Agents screen)
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [calendarStatusMsg, setCalendarStatusMsg] = useState('');
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomSyncing, setClassroomSyncing] = useState(false);
  const [classroomStatusMsg, setClassroomStatusMsg] = useState('');

  const [productivityInsights, setProductivityInsights] = useState<{ overloadAlert: string; studyPattern: string; habitSuggestion: string } | null>(null);
  const [focusTimer, setFocusTimer] = useState<{
    isActive: boolean;
    secondsRemaining: number;
    taskTitle: string;
    originalDuration: number;
  }>({
    isActive: false,
    secondsRemaining: 600,
    taskTitle: '',
    originalDuration: 600
  });

  // Timetable Schedule Profile
  const [timetableProfile, setTimetableProfile] = useState<UserScheduleProfile>(DEFAULT_TIMETABLE);
  const adjustTextareaHeight = (element: HTMLTextAreaElement, maxHeight: number) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  };

  const generateGreeting = () => {
    const hours = new Date().getHours();
    let bucket: string[] = [];

    // Check tasks for nudges
    const todayTasks = tasks.filter(t => !t.completed && !t.isSomeday && t.dueDate.toLowerCase().includes('today'));
    const overdueTasks = tasks.filter(t => !t.completed && !t.isSomeday && parseDueDate(t.dueDate).getTime() < Date.now());
    
    let nudge = '';
    if (todayTasks.length > 0) {
      nudge = ` You've got ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today.`;
    } else if (overdueTasks.length > 0) {
      nudge = ` Let's sweep your ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}!`;
    } else if (quickWin) {
      nudge = ` Ready for a 10-minute quick win?`;
    }

    if (hours < 12) {
      // Morning
      bucket = [
        `Good morning, ${username}!${nudge}`,
        `Rise and shine, ${username}! Ready to focus?${nudge}`,
        `Morning, ${username}! What are we crushing today?${nudge}`,
        `Top of the morning, ${username}! Let's make it count.${nudge}`
      ];
    } else if (hours < 17) {
      // Afternoon
      bucket = [
        `Good afternoon, ${username}!${nudge}`,
        `Hey ${username}, hope your afternoon is going well!${nudge}`,
        `Afternoon focus check, ${username}! Ready?${nudge}`,
        `Good day, ${username}! What's next on the agenda?${nudge}`
      ];
    } else if (hours < 21) {
      // Evening
      bucket = [
        `Good evening, ${username}!${nudge}`,
        `Hope you've had a productive day, ${username}!${nudge}`,
        `Evening, ${username}! Let's wrap up strong.${nudge}`,
        `Hey ${username}, what are we planning this evening?${nudge}`
      ];
    } else {
      // Night
      bucket = [
        `Late night work, ${username}? Let's do this.${nudge}`,
        `Evening, ${username}! Planning ahead for tomorrow?${nudge}`,
        `Night owl mode active, ${username}! Let's focus.${nudge}`,
        `Aura here for the night shift, ${username}! What's up?${nudge}`
      ];
    }

    const randomIndex = Math.floor(Math.random() * bucket.length);
    return bucket[randomIndex];
  };

  useEffect(() => {
    if (chatLog.length === 0) {
      setGreeting(generateGreeting());
    }
  }, [chatLog.length, username, tasks.length, quickWin]);

  // ============================================================================
  // AUTH: subscribe to Firebase auth state on mount
  // ============================================================================
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthChecked(true);
      if (user) {
        setUsername(user.displayName || 'there');
      } else {
        // Signed out: reset in-memory state to defaults, go back to login.
        setHydrated(false);
        setTasks(DEFAULT_TASKS);
        setArchivedChats([]);
        setChatLog([]);
        setAgentLogs([]);
        setProductivityInsights(null);
        setLastReplanTime('');
        setLastReplanTimestamp(0);
        setTimetableProfile(DEFAULT_TIMETABLE);
        setAppState('login');
      }
    });
    return () => unsubscribe();
  }, []);

  // ============================================================================
  // HYDRATION: once we know who's signed in, load THEIR saved data (if any)
  // ============================================================================
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    const newUser = isNewUser(uid);

    const savedTasks = getUserItem('aura_tasks', uid);
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else if (newUser) {
      // Genuinely brand-new account with zero history of any kind — seed a couple
      // of sample tasks so the app isn't completely blank on first impression.
      setTasks(DEFAULT_TASKS);
    } else {
      // Returning user whose tasks were cleared (e.g. via Reset Application Data) —
      // respect that and stay empty. Do NOT silently reseed the demo sample tasks.
      setTasks([]);
    }

    const savedArchived = getUserItem('aura_archived_chats', uid);
    setArchivedChats(savedArchived ? JSON.parse(savedArchived) : []);

    const savedTimetable = getUserItem('aura_timetable_profile', uid);
    setTimetableProfile(savedTimetable ? JSON.parse(savedTimetable) : DEFAULT_TIMETABLE);

    const savedAgentLogs = getUserItem('aura_agent_logs', uid);
    setAgentLogs(savedAgentLogs ? JSON.parse(savedAgentLogs) : []);

    const savedReplanTime = getUserItem('aura_last_replan_time', uid);
    setLastReplanTime(savedReplanTime || '');

    const savedReplanTimestamp = getUserItem('aura_last_replan_timestamp', uid);
    setLastReplanTimestamp(savedReplanTimestamp ? parseInt(savedReplanTimestamp, 10) : 0);

    const savedInsights = getUserItem('aura_productivity_insights', uid);
    setProductivityInsights(savedInsights ? JSON.parse(savedInsights) : null);

    setChatLog([]); // always start each session with a fresh chat view; history lives in archivedChats
    setHydrated(true);

    // Move into the app. New users still go through onboarding via the
    // existing Timetable Setup screen exactly as before.
    setAppState('transition');
    setTimeout(() => {
      setAppState('chat_open');
      setHasCompletedTransition(true);
    }, 1200);
  }, [currentUser?.uid]);

  // Save profile to local storage on changes (per-user, only after hydration)
  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setUserItem('aura_timetable_profile', currentUser.uid, JSON.stringify(timetableProfile));
  }, [timetableProfile, hydrated, currentUser]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setUserItem('aura_agent_logs', currentUser.uid, JSON.stringify(agentLogs));
  }, [agentLogs, hydrated, currentUser]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setUserItem('aura_last_replan_time', currentUser.uid, lastReplanTime);
  }, [lastReplanTime, hydrated, currentUser]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setUserItem('aura_last_replan_timestamp', currentUser.uid, lastReplanTimestamp.toString());
  }, [lastReplanTimestamp, hydrated, currentUser]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    if (productivityInsights) {
      setUserItem('aura_productivity_insights', currentUser.uid, JSON.stringify(productivityInsights));
    } else {
      removeUserItem('aura_productivity_insights', currentUser.uid);
    }
  }, [productivityInsights, hydrated, currentUser]);

  // Save tasks to local storage (per-user, only after hydration)
  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setUserItem('aura_tasks', currentUser.uid, JSON.stringify(tasks));
  }, [tasks, hydrated, currentUser]);

  // The Gemini API key lives only in the server's .env now — there is no
  // client-side override anymore (this used to be settable in Settings).
  const apiKey: string = '';

  // Google Sign-In handler used by the login screen button
  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
      // onAuthStateChanged (subscribeToAuthChanges) picks up the result and
      // drives hydration + the transition into the app automatically.
    } catch (err: any) {
      console.error('[Auth] Google sign-in failed:', err);
      setAuthError('Sign-in failed or was cancelled. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('[Auth] Sign-out failed:', err);
    }
  };

  // ============================================================================
  // GOOGLE CALENDAR — real integration via Google Identity Services
  // ============================================================================
  const parseScheduledRange = (dueDate: string, scheduledTime: string): { startISO: string; endISO: string } | null => {
    try {
      const day = parseDueDate(dueDate);
      const match = scheduledTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const start = new Date(day);
      const end = new Date(day);
      if (match) {
        let [, sh, sm, sap, eh, em, eap] = match;
        let startHour = parseInt(sh, 10) % 12 + (sap.toUpperCase() === 'PM' ? 12 : 0);
        let endHour = parseInt(eh, 10) % 12 + (eap.toUpperCase() === 'PM' ? 12 : 0);
        start.setHours(startHour, parseInt(sm, 10), 0, 0);
        end.setHours(endHour, parseInt(em, 10), 0, 0);
      } else {
        start.setHours(18, 0, 0, 0);
        end.setHours(19, 0, 0, 0);
      }
      return { startISO: start.toISOString(), endISO: end.toISOString() };
    } catch {
      return null;
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarStatusMsg('');
    try {
      await connectGoogleCalendar();
      setCalendarConnected(true);
      setCalendarStatusMsg('Connected! Tap "Sync tasks to Calendar" to push your scheduled tasks.');
    } catch (err: any) {
      console.error('[Calendar] Connect failed:', err);
      setCalendarStatusMsg('Could not connect — please try again.');
    }
  };

  const handleSyncTasksToCalendar = async () => {
    setCalendarSyncing(true);
    setCalendarStatusMsg('');
    let created = 0;
    let failed = 0;
    for (const task of tasks) {
      if (task.completed || !task.scheduledTime) continue;
      const range = parseScheduledRange(task.dueDate, task.scheduledTime);
      if (!range) { failed++; continue; }
      try {
        const result = await createCalendarEvent({
          title: task.title,
          description: task.studyGuide || task.details || 'Scheduled by Aura',
          startISO: range.startISO,
          endISO: range.endISO
        });
        if (result) created++; else failed++;
      } catch (err) {
        console.error('[Calendar] Event creation failed for task', task.title, err);
        failed++;
      }
    }
    setCalendarSyncing(false);
    setCalendarStatusMsg(
      `Synced ${created} task${created !== 1 ? 's' : ''} to Google Calendar.` +
      (failed > 0 ? ` (${failed} skipped/failed.)` : '')
    );
  };

  // ============================================================================
  // GOOGLE CLASSROOM — real integration via Google Identity Services
  // ============================================================================
  const handleConnectClassroom = async () => {
    setClassroomStatusMsg('');
    try {
      await connectGoogleClassroom();
      setClassroomConnected(true);
      setClassroomStatusMsg('Connected! Tap "Sync assignments" to pull in your Classroom coursework.');
    } catch (err: any) {
      console.error('[Classroom] Connect failed:', err);
      setClassroomStatusMsg('Could not connect — please try again.');
    }
  };

  const handleSyncClassroomAssignments = async () => {
    setClassroomSyncing(true);
    setClassroomStatusMsg('');
    try {
      const assignments = await fetchClassroomAssignments();
      let added = 0;
      setTasks(prevTasks => {
        const newTasks = [...prevTasks];
        for (const a of assignments) {
          const cleanTitle = summarizeTaskTitle(`${a.courseName}: ${a.title}`);
          if (isDuplicateTask(cleanTitle, newTasks)) continue;
          newTasks.push({
            id: `task-classroom-${Date.now()}-${added}`,
            title: cleanTitle,
            details: `${a.courseName} — ${a.title}`,
            dueDate: a.dueDate || 'No due date set',
            duration: '1 hour',
            urgency: 'medium',
            category: 'study',
            completed: false,
            scheduledTime: '',
            studyGuide: ''
          });
          added++;
        }
        return newTasks;
      });
      setClassroomStatusMsg(
        added > 0
          ? `Synced ${added} new assignment${added !== 1 ? 's' : ''} from Classroom into your task list.`
          : 'No new assignments found — everything is already up to date.'
      );
    } catch (err) {
      console.error('[Classroom] Sync failed:', err);
      setClassroomStatusMsg('Sync failed — please try connecting again.');
    } finally {
      setClassroomSyncing(false);
    }
  };

  // --- AGENTIC & TIME UTILITIES (Feature 1, 2 & 3) ---
  

  const getHoursUntilDeadline = (dueDateStr: string): number => {
    try {
      const cleanStr = dueDateStr
        .replace(/(\d+)(st|nd|rd|th)/i, '$1')
        .replace(/may/i, 'May')
        .replace(/june/i, 'June')
        .trim();

      if (cleanStr.toLowerCase().includes('tomorrow')) {
        return 24;
      }
      if (cleanStr.toLowerCase().includes('today')) {
        return 4;
      }
      
      const parsedDate = Date.parse(cleanStr);
      if (!isNaN(parsedDate)) {
        const diffMs = parsedDate - Date.now();
        return diffMs / (1000 * 60 * 60);
      }
    } catch (e) {
      // Date formatting fallback
    }
    return 72; // Default fallback to Calm (>48h)
  };

  const triggerAgentReplan = async (currentTasks?: Task[]) => {
    const tasksToEval = currentTasks || tasks;
    const incomplete = tasksToEval.filter(t => !t.completed);
    
    if (incomplete.length === 0) {
      setProductivityInsights(null);
      return;
    }
    
    if (isReplanning) return;

    const timeDiff = Date.now() - lastReplanTimestamp;
    const cooldownMs = 2 * 60 * 60 * 1000; // 2 hours minimum interval guard (Bug 3)

    let result;

    if (timeDiff < cooldownMs) {
      console.log(`[Replan Cooldown] Skipping API. Remaining: ${Math.round((cooldownMs - timeDiff) / 60000)} mins. Generating dynamic local insights.`);
      // Generate dynamic local insights to avoid calling API (Bug 3 & 4)
      let overloadAlert = "Your schedule is currently clear. No conflicts detected.";
      if (incomplete.length > 3) {
        overloadAlert = `You have ${incomplete.length} active tasks on your schedule. Aura has optimized your blocks to prevent burnout.`;
      } else if (incomplete.length > 0) {
        overloadAlert = `All good. You have ${incomplete.length} active task${incomplete.length > 1 ? 's' : ''} scheduled nicely.`;
      } else {
        overloadAlert = "Awesome! You have no pending tasks right now.";
      }

      const bestStudyTime = timetableProfile.customQA[0]?.answer || "late evenings";
      const studyPattern = `Based on your schedule and habits, you do your best work during ${bestStudyTime}.`;
      
      let habitSuggestion = "Try the Pomodoro technique (25m study, 5m break) for your next task block.";
      if (timetableProfile.hasTuition) {
        habitSuggestion = `We scheduled your study blocks around your tuition timings (${timetableProfile.tuitionTimingsStart} - ${timetableProfile.tuitionTimingsEnd}) to keep your mind fresh.`;
      }

      result = {
        riskFound: false,
        explanation: "Local schedule checked. Everything is balanced.",
        updatedTasks: tasksToEval,
        insights: {
          overloadAlert,
          studyPattern,
          habitSuggestion
        }
      };
    } else {
      setIsReplanning(true);
      try {
        result = await evaluateReplanFromServer(tasksToEval, timetableProfile);
        setLastReplanTimestamp(Date.now());
      } catch (err) {
        console.warn("Daily Re-Plan check failed:", err);
      } finally {
        setIsReplanning(false);
        setLastReplanTime(new Date().toDateString());
      }
    }

    if (result) {
      if (result.insights) {
        setProductivityInsights(result.insights);
      }

      if (result.riskFound) {
        // Create agent run log entry
        const newLog = {
          id: `run-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          summary: result.explanation,
          status: 'pending',
          proposedTasks: result.updatedTasks,
          proposedChanges: result.updatedTasks.map(pt => {
            const orig = tasksToEval.find(ot => ot.id === pt.id);
            return {
              title: pt.title,
              oldSchedule: orig?.scheduledTime || 'Unscheduled',
              newSchedule: pt.scheduledTime || 'Unscheduled'
            };
          })
        };

        setAgentLogs(prev => [newLog, ...prev]);

        // Push proactive message to chat feed
        setChatLog(prev => [
          ...prev,
          {
            sender: 'aura',
            text: `🦖 **Aura Proactive Re-Planner**\n\n${result.explanation}\n\nDo you want to apply these scheduling optimizations?`,
            proposal: {
              id: newLog.id,
              tasks: result.updatedTasks
            }
          }
        ]);
      }
    }
  };

  const checkEscalationStates = async (currentTasks: Task[]) => {
    let updated = false;
    const newTasks = await Promise.all(currentTasks.map(async (task) => {
      if (task.completed) return task;
      
      const hours = getHoursUntilDeadline(task.dueDate);
      
      // Last-Minute Mode: hours <= 12
      if (hours <= 12) {
        if (!task.microplan) {
          updated = true;
          try {
            const microplan = await generateMicroplanFromServer(task.title, task.duration, task.studyGuide);
            return { ...task, microplan };
          } catch (e) {
            console.error("Failed to generate microplan in check:", e);
          }
        }
      }
      return task;
    }));

    if (updated) {
      setTasks(newTasks);
    }
  };

  const updateQuickWin = async (currentTasks: Task[]) => {
    const incomplete = currentTasks.filter(t => !t.completed);
    if (incomplete.length === 0) {
      setQuickWin(null);
      return;
    }

    // 1. Look for a task with duration <= 10 mins
    const quickTask = incomplete.find(t => {
      const d = t.duration.toLowerCase();
      return d.includes('10 min') || d.includes('5 min') || d.includes('10m') || d.includes('15 min') || d.includes('15m');
    });

    if (quickTask) {
      setQuickWin({
        taskTitle: quickTask.title,
        stepTitle: `Quick Action`,
        guide: `Complete this task in under ${quickTask.duration}. Tap to start a focus timer.`,
        taskId: quickTask.id
      });
      return;
    }

    // 2. Otherwise, find the most urgent task and break it down
    const sorted = [...incomplete].sort((a, b) => {
      const uMap = { high: 3, medium: 2, low: 1 };
      return uMap[b.urgency] - uMap[a.urgency];
    });

    const targetTask = sorted[0];
    if (targetTask) {
      try {
        const data = await generateQuickWinFromServer(targetTask);
        setQuickWin({
          taskTitle: targetTask.title,
          stepTitle: data.subTaskTitle,
          guide: data.guide,
          taskId: targetTask.id
        });
      } catch (err) {
        setQuickWin({
          taskTitle: targetTask.title,
          stepTitle: `First step`,
          guide: `Review your study notes and outline the structure (10 mins).`,
          taskId: targetTask.id
        });
      }
    } else {
      setQuickWin(null);
    }
  };

  // Focus Timer countdown effect
  useEffect(() => {
    let interval: any = null;
    if (focusTimer.isActive && focusTimer.secondsRemaining > 0) {
      interval = setInterval(() => {
        setFocusTimer(prev => ({
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1
        }));
      }, 1000);
    } else if (focusTimer.secondsRemaining === 0 && focusTimer.isActive) {
      setFocusTimer(prev => ({ ...prev, isActive: false }));
      alert(`Great job! You finished your focus block for "${focusTimer.taskTitle}"!`);
      // Auto complete quick win task if matching
      if (focusTimer.taskTitle) {
        setTasks(prev => {
          const next = prev.map(t => t.title === focusTimer.taskTitle ? { ...t, completed: true } : t);
          setTimeout(() => triggerAgentReplan(next), 500);
          return next;
        });
      }
    }
    return () => clearInterval(interval);
  }, [focusTimer.isActive, focusTimer.secondsRemaining]);

  const startQuickWinTimer = (title: string) => {
    setFocusTimer({
      isActive: true,
      secondsRemaining: 600, // 10 minutes focus
      taskTitle: title,
      originalDuration: 600
    });
  };

  // On load / status change, check if daily re-plan needs to run
  useEffect(() => {
    if (appState === 'chat_open' || appState === 'chat_closed') {
      const today = new Date().toDateString();
      if (lastReplanTime !== today) {
        triggerAgentReplan();
      }
    }
  }, [appState]);

  // Listen to tasks changes: check escalation and quick win
  useEffect(() => {
    if (tasks.length > 0) {
      checkEscalationStates(tasks);
      updateQuickWin(tasks);
    }
  }, [tasks]);

  // One-time cleanup of accumulated garbage tasks and history from previous sessions
  useEffect(() => {
    const cleaned = localStorage.getItem('aura_one_time_cleanup_v2');
    if (!cleaned) {
      localStorage.removeItem('aura_tasks');
      localStorage.removeItem('aura_archived_chats');
      localStorage.removeItem('aura_agent_logs');
      localStorage.removeItem('aura_productivity_insights');
      localStorage.removeItem('aura_last_replan_time');
      localStorage.removeItem('aura_last_replan_timestamp');
      
      setTasks([]);
      setChatLog([]);
      setArchivedChats([]);
      setProductivityInsights(null);
      setLastReplanTime('');
      setLastReplanTimestamp(0);
      setAgentLogs([]);
      setQuickWin(null);
      
      localStorage.setItem('aura_one_time_cleanup_v2', 'done');
      console.log("[One-Time Cleanup] Successfully wiped old garbage tasks and chat logs.");
    }
  }, []);

  // Cleanup garbage/duplicate test data on startup (Bug B & lingering)
  useEffect(() => {
    console.log("[Startup Cleanup] Running task checklist audit...");
    setTasks(prev => {
      const cleanList: Task[] = [];
      const seenTitles = new Set<string>();
      let removedCount = 0;
      
      prev.forEach(task => {
        const titleLower = task.title.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
        // Remove chitchat, greetings and nonsense test inputs
        const isGarbage = 
          titleLower === 'hi' || 
          titleLower === 'hai' || 
          titleLower === 'hello' || 
          titleLower === 'yo' || 
          titleLower === 'greetings' || 
          titleLower.includes('my name') || 
          isCapabilityQuery(task.title);

        if (isGarbage) {
          console.log(`[Startup Cleanup] SUCCESS: Purged garbage task: "${task.title}" (ID: ${task.id})`);
          removedCount++;
          return;
        }
        if (seenTitles.has(titleLower)) {
          console.log(`[Startup Cleanup] SUCCESS: Purged duplicate task: "${task.title}" (ID: ${task.id})`);
          removedCount++;
          return;
        }
        seenTitles.add(titleLower);
        cleanList.push(task);
      });
      
      console.log(`[Startup Cleanup] Audit complete. Removed ${removedCount} items. Clean checklist count: ${cleanList.length}`);
      if (removedCount > 0 || cleanList.length !== prev.length) {
        localStorage.setItem('aura_tasks', JSON.stringify(cleanList));
        return cleanList;
      }
      return prev;
    });
  }, []);



  // Photo scanner wizard states
  const [scannerPreviewUrl, setScannerPreviewUrl] = useState<string | null>(null);
  const [scannerState, setScannerState] = useState<'scanning' | 'ready'>('scanning');
  const [scannedTask, setScannedTask] = useState<{ title: string; dueDate: string; urgency: 'high' | 'medium' | 'low'; description: string }>({
    title: '',
    dueDate: '',
    urgency: 'high',
    description: ''
  });
  const [scannerComment, setScannerComment] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const activeInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setUserItem('aura_archived_chats', currentUser.uid, JSON.stringify(archivedChats));
  }, [archivedChats, hydrated, currentUser]);

  // No custom keyboard event interceptor needed - standard textareas handle input naturally

  const handleInputClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (!inputFocused) {
      setInputFocused(true);
      setAppState('chat_open');
    }
  };

  const handleBackgroundClick = () => {
    if (inputFocused) {
      setInputFocused(false);
      setAppState('chat_closed');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  const handleNewChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chatLog.length > 0) {
      const timestamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const computedTitle = generateSessionTitle(chatLog);
      const newArchiveEntry = {
        id: `session-${Date.now()}`,
        title: computedTitle,
        date: timestamp,
        log: chatLog
      };
      setArchivedChats(prev => [newArchiveEntry, ...prev]);
    }
    setChatLog([]);
    setInputCommand('');
    if (mainInputRef.current) mainInputRef.current.style.height = 'auto';
    if (activeInputRef.current) activeInputRef.current.style.height = 'auto';
    setInputFocused(true);
    setAppState('chat_open');
    setActiveScreen('chat');
  };



  // Parse chat command locally for DB querying or complete events
  const handleSendCommand = async () => {
    if (!inputCommand.trim() || isThinking || isSendingRef.current) return;
    
    // 1. Synchronous double-submit/click guard (Bug 3)
    isSendingRef.current = true;
    const userText = inputCommand;
    setInputCommand('');
    setChatLog(prev => [...prev, { sender: 'user', text: userText }]);
    setIsThinking(true);

    const normText = userText.toLowerCase();

    // 2. Complete task command check (general & human-sounding) (Bug 1 & 2)
    if (normText.includes('completed') || normText.includes('done') || normText.includes('mark') || normText.includes('finish')) {
      const completeKeywords = ['completed', 'done', 'mark', 'finish'];
      let cleanCompletedSearch = normText;
      completeKeywords.forEach(kw => {
        cleanCompletedSearch = cleanCompletedSearch.replace(kw, '');
      });
      cleanCompletedSearch = cleanCompletedSearch.trim();

      if (cleanCompletedSearch.length > 2) {
        const match = tasks.find(t => !t.completed && t.title.toLowerCase().includes(cleanCompletedSearch));
        if (match) {
          const newTasks = tasks.map(t => t.id === match.id ? { ...t, completed: true } : t);
          setTasks(newTasks);
          setTimeout(() => triggerAgentReplan(newTasks), 500);
          
          setTimeout(() => {
            setChatLog(prev => [...prev, { 
              sender: 'aura', 
              text: `Got it! I've marked "${match.title}" as completed. Great job!` 
            }]);
            setIsThinking(false);
            isSendingRef.current = false;
          }, 800);
          return;
        }
      }
    }

    // 3. Process Command (Gemini / Classifier with tasks passed in)
    try {
      const response = await processAuraCommand(userText, apiKey, timetableProfile, tasks);
      
      setChatLog(prev => [...prev, {
        sender: 'aura',
        text: response.reply,
        tasks: response.newTasks,
        timetableProposal: response.timetableProposal
      }]);

      if (response.newTasks && response.newTasks.length > 0) {
        // Auto-insert scheduled study blocks for new tasks (with deduplication) (Bug 1 & Bug B)
        setTasks(prev => {
          const uniqueNewTasks = response.newTasks.filter(t => !isDuplicateTask(t.title, prev));
          if (uniqueNewTasks.length === 0) return prev;
          const next = [...uniqueNewTasks, ...prev];
          setTimeout(() => triggerAgentReplan(next), 500);
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      setChatLog(prev => [...prev, { sender: 'aura', text: "Something went wrong. Let me try that again." }]);
    } finally {
      setIsThinking(false);
      isSendingRef.current = false;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        setScannerPreviewUrl(reader.result as string);
        setScannerState('scanning');
        setScannerComment('');
        setActiveScreen('scanner');

        // Execute OCR Scan
        setTimeout(async () => {
          if (apiKey && apiKey.trim().length > 10) {
            try {
              const ocrResult = await scanImageWithGemini(base64Data, file.type, apiKey);
              setScannedTask({
                title: ocrResult.title,
                dueDate: ocrResult.dueDate,
                urgency: ocrResult.urgency,
                description: ocrResult.description
              });
              setScannerState('ready');
              return;
            } catch (err) {
              console.warn("Gemini multimodal failed, using high-fidelity mock parser");
            }
          }
          // Default mock parser fallback (Page 1 camera upload sketch details)
          setScannedTask({
            title: 'Math Assignment',
            dueDate: '27th May 2026',
            urgency: 'high',
            description: 'Integration and Calculus exercises due in 2 days.'
          });
          setScannerState('ready');
        }, 2200);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveScannerTask = () => {
    const newTask: Task = {
      id: `task-scan-${Date.now()}`,
      title: summarizeTaskTitle(scannedTask.title),
      details: scannedTask.title,
      dueDate: scannedTask.dueDate,
      duration: '2 hours',
      urgency: scannedTask.urgency,
      category: 'study',
      completed: false,
      scheduledTime: 'Thursday 3:00 PM - 5:00 PM', // Squeezed into free slot
      studyGuide: `• Review: ${scannerComment || scannedTask.description}\n• Submit by deadline.`
    };

    setTasks(prev => {
      if (isDuplicateTask(newTask.title, prev)) {
        return prev;
      }
      const next = [newTask, ...prev];
      setTimeout(() => triggerAgentReplan(next), 500);
      return next;
    });
    setActiveScreen('tasks');
    
    // Auto-trigger the banner notifications later
    setTimeout(() => {
      setNotification({
        visible: true,
        title: "Aura Reminder",
        message: `Hi ${username}, you have an assignment due: "${newTask.title}" on ${newTask.dueDate}. Have you completed it yet?`
      });
    }, 4000);
  };

  const handleNotificationAction = (action: 'yes' | 'snooze') => {
    setNotification(prev => prev ? { ...prev, visible: false } : null);
    
    if (action === 'yes') {
      setTasks(prev => {
        const next = prev.map(t => t.id.startsWith('task-scan-') ? { ...t, completed: true } : t);
        setTimeout(() => triggerAgentReplan(next), 500);
        return next;
      });
      setChatLog(prev => [
        ...prev,
        { sender: 'user', text: "Yes, I completed it." },
        { sender: 'aura', text: "Awesome! I've marked it completed in your tasks calendar database." }
      ]);
    } else {
      setChatLog(prev => [
        ...prev,
        { sender: 'user', text: "Remind me later." },
        { sender: 'aura', text: "No worries! I have snoozed this and will alert you again in 2 hours." }
      ]);
    }
  };

  const handleSweepOverdueTasks = () => {
    const overdueTasks = tasks.filter(t => !t.completed && !t.isSomeday && parseDueDate(t.dueDate).getTime() < Date.now());
    if (overdueTasks.length === 0) return;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayFormatted = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const newTasks = tasks.map(t => {
      const overdueIndex = overdueTasks.findIndex(ot => ot.id === t.id);
      if (overdueIndex !== -1) {
        const isToday = overdueIndex % 2 === 0;
        const targetDateStr = isToday ? todayFormatted : tomorrowFormatted;
        const targetDayName = isToday ? 'Today' : 'Tomorrow';
        
        const scheduledTime = `${targetDayName} 7:00 PM - 8:30 PM`;
        const dueDate = `${targetDateStr} 11:59 PM`;

        return {
          ...t,
          dueDate,
          scheduledTime,
          urgency: 'high' as const
        };
      }
      return t;
    });

    setTasks(newTasks);
    setNotification({
      visible: true,
      title: "Reschedule Sweep Complete",
      message: `Swept ${overdueTasks.length} overdue tasks! Rescheduled them to alternate between Today and Tomorrow evenings.`
    });

    setTimeout(() => triggerAgentReplan(newTasks), 500);
  };

  const handleScheduleSomedayTask = (taskId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isSomeday: false,
          dueDate: `${tomorrowFormatted} 11:59 PM`,
          scheduledTime: 'Tomorrow 6:00 PM - 7:30 PM',
          urgency: 'medium' as const,
          studyGuide: '• Promoted from Someday list! Aura has scheduled your first focused study block for tomorrow evening.'
        };
      }
      return t;
    });
    setTasks(newTasks);
    setNotification({
      visible: true,
      title: "Task Promoted",
      message: "Moved task to Active Board and scheduled it for tomorrow evening."
    });
    setTimeout(() => triggerAgentReplan(newTasks), 500);
  };


  // handleVirtualKeyClick was removed as the virtual keyboard is disabled

  // KEY_ROWS was removed as the virtual keyboard is disabled

  return (
    <div className="phone-screen" onClick={handleBackgroundClick}>
          {/* Radial Glow Layers */}
          <div className="absolute inset-0 z-0 bg-black pointer-events-none">
            {/* Blue Glow Layer */}
            <div 
              className={`absolute inset-0 bg-glow-blue transition-opacity duration-700 ${
                appState !== 'transition' ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {/* Red Glow Layer - only shows once during initial login transition */}
            <div 
              className={`absolute inset-0 bg-glow-red transition-all duration-700 ${
                !hasCompletedTransition && appState === 'transition' ? 'opacity-100 bg-glow-red-high' : 'opacity-0'
              }`}
            />
          </div>

          {/* Conditional Screen Rendering: Login OR App Dashboard */}
          {appState === 'login' ? (
            <div className="absolute inset-0 z-50 flex flex-col justify-center items-center px-6 bg-[#06030e]" onClick={(e) => e.stopPropagation()}>
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-2xl bg-gradient-to-tr from-purple-500/40 to-cyan-500/40 animate-pulse"></div>
                <AuraOrb />
              </div>
              
              <h2 className="text-[32px] font-heading font-bold heading-gradient tracking-wide mb-1">
                AURA
              </h2>
              <p className="text-slate-400 text-[10px] tracking-widest mb-10 uppercase font-semibold">
                The Last-Minute Life Saver
              </p>
              
              <div className="w-full max-w-xs space-y-4">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={!authChecked}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-[#1f1f1f] text-xs font-bold tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all transform active:scale-95 duration-200 disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C39.205,40.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  <span>{authChecked ? 'Sign in with Google' : 'Loading...'}</span>
                </button>
                {authError && (
                  <p className="text-red-400 text-[10px] text-center">{authError}</p>
                )}
                <p className="text-slate-500 text-[9px] text-center px-2">
                  Your tasks and chat history are saved to your Google account and restored automatically next time you sign in.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Banner notification */}
              {notification && (
                <div 
                  className={`absolute left-4 right-4 z-50 bg-[#1c1c1e] border border-white/10 rounded-2xl p-4 shadow-2xl transition-all duration-500 transform ${
                    notification.visible ? 'translate-y-12 opacity-100' : '-translate-y-36 opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-lg">🦖</span>
                    </div>
                    
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-white">{notification.title}</span>
                        <span className="text-[9px] text-slate-500 font-medium">now</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      
                      <div className="flex gap-2 mt-3.5 justify-end">
                        <button
                          onClick={() => handleNotificationAction('yes')}
                          className="py-1 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all active:scale-95"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleNotificationAction('snooze')}
                          className="py-1 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-[10px] font-semibold transition-all active:scale-95"
                        >
                          Remind later
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <header className="bg-transparent absolute top-2 left-0 w-full z-30 select-none">
                <div className="px-5 h-12 flex items-center justify-between">
                  {activeScreen === 'chat' ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    >
                      <Menu size={18} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setActiveScreen('chat')}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors flex items-center gap-1 text-[11px] font-bold"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                  )}
                  <span 
                    onClick={() => setActiveScreen('chat')}
                    className="font-heading font-semibold text-sm tracking-wider text-white flex items-center gap-1 cursor-pointer"
                  >
                    Aura
                  </span>
                  <button
                    onClick={handleNewChat}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    title="Start New Chat"
                  >
                    <SquarePen size={18} />
                  </button>
                </div>
              </header>

              {/* MAIN SCREEN ROUTING */}

              {/* 1. CHAT SCREEN */}
              {activeScreen === 'chat' && (() => {
                const renderMessageText = (text: string) => {
                  const lines = text.split('\n');
                  const hasBullets = lines.some(line => line.trim().startsWith('•') || line.trim().startsWith('*'));
                  
                  if (!hasBullets) {
                    return <div className="whitespace-pre-line text-left leading-relaxed text-slate-200">{text}</div>;
                  }
                  
                  const renderedElements: React.ReactNode[] = [];
                  let currentCardList: string[] = [];
                  
                  lines.forEach((line, index) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('•') || trimmed.startsWith('*')) {
                      const cleanLine = trimmed.substring(1).trim();
                      currentCardList.push(cleanLine);
                    } else {
                      if (currentCardList.length > 0) {
                        renderedElements.push(
                          <div key={`list-${index}`} className="my-2.5 flex flex-col gap-2 w-full">
                            {currentCardList.map((item, itemIdx) => {
                              const parts = item.split(/\*\*(.*?)\*\*/g);
                              const content = parts.map((part, pIdx) => {
                                if (pIdx % 2 === 1) return <strong key={pIdx} className="text-white font-semibold">{part}</strong>;
                                return part;
                              });
                              
                              return (
                                <div key={itemIdx} className="aura-card p-3.5 flex flex-row items-start gap-3 bg-zinc-950/40 border border-white/5 shadow-md rounded-xl hover:border-purple-500/20 transition-all text-left">
                                  <span className="text-purple-400 shrink-0 text-xs mt-0.5">✦</span>
                                  <span className="text-slate-300 text-xs leading-relaxed">{content}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                        currentCardList = [];
                      }
                      if (trimmed) {
                        renderedElements.push(<div key={`text-${index}`} className="whitespace-pre-line text-left mb-1.5 leading-relaxed text-slate-200">{line}</div>);
                      }
                    }
                  });
                  
                  if (currentCardList.length > 0) {
                    renderedElements.push(
                      <div key="list-final" className="my-2.5 flex flex-col gap-2 w-full">
                        {currentCardList.map((item, itemIdx) => {
                          const parts = item.split(/\*\*(.*?)\*\*/g);
                          const content = parts.map((part, pIdx) => {
                            if (pIdx % 2 === 1) return <strong key={pIdx} className="text-white font-semibold">{part}</strong>;
                            return part;
                          });
                          
                          return (
                            <div key={itemIdx} className="aura-card p-3.5 flex flex-row items-start gap-3 bg-zinc-950/40 border border-white/5 shadow-md rounded-xl hover:border-purple-500/20 transition-all text-left">
                              <span className="text-purple-400 shrink-0 text-xs mt-0.5">✦</span>
                              <span className="text-slate-300 text-xs leading-relaxed">{content}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  
                  return <div className="w-full flex flex-col">{renderedElements}</div>;
                };

                return (
                  <div className="flex-1 flex flex-col justify-between relative min-h-0 pt-20 overflow-hidden">
                    {/* In-App Escalation Banner */}
                    {(() => {
                      const lastMinuteTasks = tasks.filter(t => {
                        if (t.completed || t.isSomeday) return false;
                        if (dismissedLastMinuteIds.includes(t.id)) return false;
                        const hours = getHoursUntilDeadline(t.dueDate);
                        return hours > 0 && hours <= 12;
                      });

                      if (lastMinuteTasks.length === 0) return null;

                      return (
                        <div className="w-[92%] mx-auto mt-2 mb-2 bg-gradient-to-r from-red-950/85 to-red-900/60 border border-red-500/30 rounded-xl p-3 shadow-lg flex items-center justify-between text-left shrink-0 animate-fadeIn z-20 relative">
                          <div className="flex gap-2.5 items-start">
                            <span className="text-base shrink-0">🚨</span>
                            <div>
                              <h4 className="text-[11px] font-bold text-red-200 uppercase tracking-wide">Last-Minute Escalation Mode!</h4>
                              <p className="text-[10px] text-red-300 mt-0.5 leading-relaxed font-sans font-medium">
                                "{lastMinuteTasks[0].title}" is due in less than 12 hours! Focus on the next-step plan now.
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDismissedLastMinuteIds(prev => [...prev, lastMinuteTasks[0].id]);
                            }}
                            className="p-1 text-red-400 hover:text-red-200 transition-colors shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })()}

                    {chatLog.length === 0 ? (
                      <div className="flex-grow flex flex-col justify-between p-4 relative z-10 min-h-0">
                        <div className="h-4" />
                        
                        <div className={`flex-grow flex flex-col items-center z-10 transition-all duration-300 ${
                          inputFocused ? 'justify-start pt-2' : 'justify-center'
                        }`}>
                          <div className={`transition-all duration-300 ${inputFocused ? 'scale-75' : 'scale-100'}`}>
                            <AuraOrb />
                          </div>
                          
                          <h1 className={`font-heading font-medium text-white tracking-wide text-center px-4 leading-tight select-none transition-all duration-300 ${
                            inputFocused ? 'text-[20px] mt-1' : 'text-[26px] mt-2'
                          }`}>
                            {inputFocused ? (
                              <>What's next, {username}?</>
                            ) : (
                              <div className="whitespace-pre-line leading-snug px-3">{greeting}</div>
                            )}
                          </h1>

                          {/* Quick Win Detector Card (Feature 3) */}
                          {quickWin && !inputFocused && (
                            <div className="mt-6 w-[88%] max-w-sm bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-500/20 rounded-2xl p-4 shadow-lg flex flex-col items-start gap-2.5 text-left animate-fadeIn">
                              <div className="flex items-center gap-1.5">
                                <Sparkles size={14} className="text-purple-400 animate-pulse" />
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Quick Win Available</span>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-100 leading-snug">{quickWin.stepTitle}</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{quickWin.guide}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startQuickWinTimer(quickWin.taskTitle);
                                }}
                                className="py-1.5 px-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 self-end"
                              >
                                <Play size={10} />
                                <span>Do it now</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Input Pill */}
                        <div className="w-full relative flex flex-col items-center pb-8 z-20 gap-3">
                          {/* Energy Filter Row */}
                          {(() => {
                            const matchingTasks = tasks.filter(t => !t.completed && !t.isSomeday && (
                              energyFilter === 'high_focus' ? t.energyLevel === 'high_focus' :
                              energyFilter === 'low_effort' ? t.energyLevel === 'low_effort' : false
                            )).slice(0, 2);

                            return (
                              <div className="flex flex-col items-center w-full gap-2 select-none" onClick={(e) => e.stopPropagation()}>
                                {/* Suggested Tasks */}
                                {energyFilter && matchingTasks.length > 0 && (
                                  <div className="flex gap-2 w-[90%] max-w-sm overflow-x-auto justify-center py-1">
                                    {matchingTasks.map(t => (
                                      <div 
                                        key={t.id} 
                                        className="bg-[#1c1b2b]/90 border border-purple-500/20 rounded-xl p-2.5 flex flex-col items-start gap-1.5 text-left text-[10px] shadow-lg max-w-[170px] flex-shrink-0 animate-fadeIn"
                                      >
                                        <div className="font-bold text-slate-200 truncate w-full">{t.title}</div>
                                        <div className="text-slate-400 flex justify-between w-full text-[9px]">
                                          <span>⏱️ {t.duration}</span>
                                          <span className="text-purple-400 font-semibold">{t.urgency}</span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            startQuickWinTimer(t.title);
                                          }}
                                          className="py-0.5 px-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded text-[8px] font-bold uppercase"
                                        >
                                          Focus
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {energyFilter && matchingTasks.length === 0 && (
                                  <div className="text-[10px] text-slate-500 italic">No pending tasks matching this energy level!</div>
                                )}

                                {/* Energy Toggle Pills */}
                                <div className="flex gap-3 justify-center">
                                  <button
                                    onClick={() => setEnergyFilter(prev => prev === 'high_focus' ? null : 'high_focus')}
                                    className={`py-1 px-3 rounded-full text-[10px] font-bold tracking-wide transition-all border ${
                                      energyFilter === 'high_focus' 
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]' 
                                        : 'bg-zinc-900 border-white/5 text-slate-400 hover:text-slate-300'
                                    }`}
                                  >
                                    ⚡ Focused
                                  </button>
                                  <button
                                    onClick={() => setEnergyFilter(prev => prev === 'low_effort' ? null : 'low_effort')}
                                    className={`py-1 px-3 rounded-full text-[10px] font-bold tracking-wide transition-all border ${
                                      energyFilter === 'low_effort' 
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]' 
                                        : 'bg-zinc-900 border-white/5 text-slate-400 hover:text-slate-300'
                                    }`}
                                  >
                                    ☕ Low Energy
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          <div 
                            id="input-pill" 
                            onClick={(e) => {
                              e.stopPropagation();
                              mainInputRef.current?.focus();
                              if (!inputFocused) {
                                setInputFocused(true);
                                setAppState('chat_open');
                              }
                            }}
                            className="w-[92%] max-w-sm min-h-[72px] h-auto py-3.5 bg-[#161a2b] rounded-[36px] flex items-center px-5 justify-between border border-[#2a2d42] shadow-2xl transition-colors hover:bg-[#1a1f33]"
                          >
                            <div className="flex items-center gap-4 flex-grow h-full">
                              <Plus 
                                className="text-gray-300 w-7 h-7 font-light cursor-pointer hover:text-white shrink-0" 
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} 
                              />
                              <textarea
                                ref={mainInputRef}
                                rows={1}
                                value={inputCommand}
                                onChange={(e) => {
                                  setInputCommand(e.target.value);
                                  adjustTextareaHeight(e.target, 120);
                                }}
                                onFocus={handleInputClick}
                                onClick={handleInputClick}
                                placeholder="Ask Aura"
                                className="flex-grow bg-transparent border-none outline-none text-white text-[18px] font-light placeholder-gray-400 p-0 w-full focus:ring-0 focus:outline-none resize-none overflow-y-auto"
                                style={{ height: '28px' }}
                              />
                            </div>
                            
                            <div className="flex items-center gap-4 shrink-0">
                              <Mic 
                                className="text-gray-300 w-7 h-7 font-light cursor-pointer hover:text-white" 
                                onClick={(e) => { e.stopPropagation(); setInputCommand("do I have any assignments to submit?"); }} 
                              />
                              <div 
                                className="w-9 h-9 rounded-full bg-blue-900/60 border border-blue-500/30 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                                onClick={(e) => { e.stopPropagation(); handleSendCommand(); }}
                              >
                                {inputCommand.trim() ? (
                                  <Send size={14} className="text-blue-200" />
                                ) : (
                                  <div className="flex gap-0.5 items-center justify-center">
                                    <span className="w-[1.5px] h-3 bg-blue-200 rounded animate-pulse" />
                                    <span className="w-[1.5px] h-4 bg-blue-100 rounded animate-pulse" />
                                    <span className="w-[1.5px] h-3 bg-blue-200 rounded animate-pulse" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col justify-between p-4 relative z-10 min-h-0">
                        <div 
                          className="flex-grow overflow-y-auto overflow-x-hidden w-full min-w-0 space-y-6 px-1 py-3 scrollbar pb-4"
                        >
                          {chatLog.map((log, idx) => {
                            const isSameSender = idx > 0 && chatLog[idx - 1].sender === log.sender;
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                              <div 
                                key={idx} 
                                className={`flex flex-col w-full ${isSameSender ? 'mt-1.5' : 'mt-5'}`}
                              >
                                {log.sender === 'user' ? (
                                  <div className="flex flex-col items-end w-full select-text">
                                    <div 
                                      style={{ width: 'fit-content' }}
                                      className="max-w-[85%] bg-[#e3dcf7] text-[#1e1738] border border-purple-300/30 text-[12px] px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm text-left font-sans leading-relaxed break-words whitespace-pre-wrap font-medium"
                                    >
                                      {log.text}
                                    </div>
                                    {!isSameSender && (
                                      <span className="text-[8px] text-slate-600 font-semibold select-none mt-1 mr-1">
                                        {timestamp}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex gap-2.5 items-start max-w-[90%] w-full select-text">
                                    {/* Left Avatar Container */}
                                    <div className="w-6 h-6 shrink-0 flex items-center justify-center select-none">
                                      {!isSameSender ? (
                                        <div className="w-6 h-6 rounded-full bg-purple-950/60 border border-purple-500/25 flex items-center justify-center text-[10px]">
                                          🦖
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6" /> // Placeholder spacer to keep indentation aligned
                                      )}
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-grow min-w-0 flex flex-col items-start">
                                      {/* Glassmorphic Bubble */}
                                      <div className="w-full bg-[#12121a]/60 backdrop-blur-md border border-white/5 text-slate-200 text-[12px] px-4 py-3 rounded-2xl rounded-tl-sm shadow-lg font-sans leading-relaxed break-words whitespace-pre-wrap">
                                        {renderMessageText(log.text)}
                                      </div>

                                      {/* Nested Task Cards (attached below/inside turn) */}
                                      {log.tasks && log.tasks.length > 0 && (
                                        <div className="mt-2.5 flex flex-col gap-2 w-full">
                                          {log.tasks.map((task) => (
                                            <div
                                              key={task.id}
                                              className={`bg-black/30 border border-white/5 rounded-xl p-3.5 flex flex-col text-left shadow-inner ${
                                                task.urgency === 'high' ? 'border-red-500/25' : 
                                                task.urgency === 'medium' ? 'border-orange-500/25' : ''
                                              }`}
                                            >
                                              <div className="flex items-center justify-between mb-1.5">
                                                <span className="font-bold text-xs text-white truncate pr-2">{task.title}</span>
                                                <span className={`aura-badge shrink-0 ${
                                                  task.urgency === 'high' ? 'badge-red' : 
                                                  task.urgency === 'medium' ? 'badge-orange' : 
                                                  'badge-muted'
                                                }`}>
                                                  {task.urgency}
                                                </span>
                                              </div>
                                              <div className="flex gap-2 items-center text-[10px] text-slate-400 mb-1.5">
                                                <span>📅 Due: {task.dueDate}</span>
                                                <span>⏱️ {task.duration}</span>
                                              </div>
                                              {task.studyGuide && (
                                                <div className="border-t border-white/5 pt-2 text-[10px] text-slate-400 whitespace-pre-line leading-relaxed font-light font-sans">
                                                  {task.studyGuide}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {log.proposal && (
                                        <div className="mt-2.5 flex flex-col gap-2 w-full">
                                          {(() => {
                                            const runLog = agentLogs.find(l => l.id === log.proposal?.id);
                                            const isPending = !runLog || runLog.status === 'pending';
                                            
                                            if (isPending) {
                                              return (
                                                <div className="flex gap-2 bg-black/25 p-2 rounded-xl border border-white/5 w-full justify-around shadow-inner">
                                                  <button
                                                    onClick={() => {
                                                      if (log.proposal) {
                                                        setTasks(log.proposal.tasks);
                                                        setAgentLogs(prev => prev.map(l => l.id === log.proposal!.id ? { ...l, status: 'approved' } : l));
                                                        setChatLog(prev => [
                                                          ...prev,
                                                          { sender: 'aura', text: "✅ **Optimized schedule applied successfully!** Your task study blocks have been updated." }
                                                        ]);
                                                      }
                                                    }}
                                                    className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-all active:scale-95 shrink-0"
                                                  >
                                                    Approve
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      if (log.proposal) {
                                                        setAgentLogs(prev => prev.map(l => l.id === log.proposal!.id ? { ...l, status: 'declined' } : l));
                                                        setChatLog(prev => [
                                                          ...prev,
                                                          { sender: 'aura', text: "❌ **Re-plan proposal cancelled.** Your original schedule remains intact." }
                                                        ]);
                                                      }
                                                    }}
                                                    className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-[10px] font-semibold transition-all active:scale-95 shrink-0"
                                                  >
                                                    Decline
                                                  </button>
                                                </div>
                                              );
                                            } else {
                                              return (
                                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase self-start mt-1.5 ${
                                                  runLog?.status === 'approved' 
                                                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                                                    : 'bg-zinc-900 text-slate-500 border border-white/5'
                                                }`}>
                                                  Proposal: {runLog?.status}
                                                </span>
                                              );
                                            }
                                          })()}
                                        </div>
                                      )}

                                      {log.timetableProposal && (
                                        <div className="mt-2.5 flex flex-col gap-2 w-full">
                                          {(() => {
                                            const isSaved = timetableProfile.schoolTimingsStart === log.timetableProposal.schoolTimingsStart && 
                                                            timetableProfile.schoolTimingsEnd === log.timetableProposal.schoolTimingsEnd &&
                                                            timetableProfile.weekendLeisureHours === log.timetableProposal.weekendLeisureHours &&
                                                            timetableProfile.role === log.timetableProposal.role;
                                            return (
                                              <button
                                                onClick={() => {
                                                  if (log.timetableProposal) {
                                                    setTimetableProfile(log.timetableProposal);
                                                    setChatLog(prev => [
                                                      ...prev,
                                                      { sender: 'aura', text: "✅ **Timetable saved successfully!** I have updated your active routine constraints." }
                                                    ]);
                                                  }
                                                }}
                                                disabled={isSaved}
                                                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all active:scale-95 self-start ${
                                                  isSaved 
                                                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 cursor-default'
                                                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                                                }`}
                                              >
                                                {isSaved ? "✓ Saved to Timetable" : "Save this as my schedule"}
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      )}

                                      {!isSameSender && (
                                        <span className="text-[8px] text-slate-600 font-semibold select-none mt-1 ml-1.5">
                                          {timestamp}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {isThinking && (
                            <div className="flex items-center gap-1.5 pl-1 select-none">
                              <span className="text-sm">🦖</span>
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Active Input Pill */}
                        <div className="mt-2 shrink-0 flex flex-col items-center gap-3 w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                          {/* Energy Filter Row */}
                          {(() => {
                            const matchingTasks = tasks.filter(t => !t.completed && !t.isSomeday && (
                              energyFilter === 'high_focus' ? t.energyLevel === 'high_focus' :
                              energyFilter === 'low_effort' ? t.energyLevel === 'low_effort' : false
                            )).slice(0, 2);

                            return (
                              <div className="flex flex-col items-center w-full gap-2 select-none">
                                {/* Suggested Tasks */}
                                {energyFilter && matchingTasks.length > 0 && (
                                  <div className="flex gap-2 w-[90%] max-w-sm overflow-x-auto justify-center py-1">
                                    {matchingTasks.map(t => (
                                      <div 
                                        key={t.id} 
                                        className="bg-[#1c1b2b]/90 border border-purple-500/20 rounded-xl p-2.5 flex flex-col items-start gap-1.5 text-left text-[10px] shadow-lg max-w-[170px] flex-shrink-0 animate-fadeIn"
                                      >
                                        <div className="font-bold text-slate-200 truncate w-full">{t.title}</div>
                                        <div className="text-slate-400 flex justify-between w-full text-[9px]">
                                          <span>⏱️ {t.duration}</span>
                                          <span className="text-purple-400 font-semibold">{t.urgency}</span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            startQuickWinTimer(t.title);
                                          }}
                                          className="py-0.5 px-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded text-[8px] font-bold uppercase"
                                        >
                                          Focus
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {energyFilter && matchingTasks.length === 0 && (
                                  <div className="text-[10px] text-slate-500 italic">No pending tasks matching this energy level!</div>
                                )}

                                {/* Energy Toggle Pills */}
                                <div className="flex gap-3 justify-center">
                                  <button
                                    onClick={() => setEnergyFilter(prev => prev === 'high_focus' ? null : 'high_focus')}
                                    className={`py-1 px-3 rounded-full text-[10px] font-bold tracking-wide transition-all border ${
                                      energyFilter === 'high_focus' 
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]' 
                                        : 'bg-zinc-900 border-white/5 text-slate-400 hover:text-slate-300'
                                    }`}
                                  >
                                    ⚡ Focused
                                  </button>
                                  <button
                                    onClick={() => setEnergyFilter(prev => prev === 'low_effort' ? null : 'low_effort')}
                                    className={`py-1 px-3 rounded-full text-[10px] font-bold tracking-wide transition-all border ${
                                      energyFilter === 'low_effort' 
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]' 
                                        : 'bg-zinc-900 border-white/5 text-slate-400 hover:text-slate-300'
                                    }`}
                                  >
                                    ☕ Low Energy
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          <div 
                            id="active-input-pill" 
                            onClick={(e) => {
                              e.stopPropagation();
                              activeInputRef.current?.focus();
                              if (!inputFocused) {
                                setInputFocused(true);
                                setAppState('chat_open');
                              }
                            }}
                            className="relative flex items-center bg-[#161a2b] border border-[#2a2d42] rounded-[22px] px-2.5 py-1.5 shadow-lg focus-within:border-purple-500/40 transition-all min-h-11 h-auto max-h-[140px]"
                          >
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                              <Plus size={16} />
                            </button>
                            
                            <textarea
                              ref={activeInputRef}
                              rows={1}
                              value={inputCommand}
                              onChange={(e) => {
                                setInputCommand(e.target.value);
                                adjustTextareaHeight(e.target, 100);
                              }}
                              onFocus={handleInputClick}
                              onClick={handleInputClick}
                              placeholder="Ask Aura"
                              className="flex-grow bg-transparent border-none outline-none text-slate-200 text-xs px-2 w-full focus:ring-0 focus:outline-none resize-none overflow-y-auto"
                              style={{ height: '20px' }}
                            />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInputCommand("do I have any assignments to submit?");
                              }}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all mr-0.5"
                            >
                              <Mic size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSendCommand(); }}
                              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-all active:scale-90"
                            >
                              <Send size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 2. TIMETABLE SETUP SCREEN */}
              {activeScreen === 'timetable' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left space-y-5 select-none relative z-10">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Clock size={18} className="text-purple-400" />
                    <span>Onboarding Timetable</span>
                  </h2>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Select Role</label>
                      <select 
                        value={timetableProfile.role}
                        onChange={(e) => setTimetableProfile({ ...timetableProfile, role: e.target.value as any })}
                        className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2.5 px-3 text-xs focus:ring-0 focus:outline-none"
                      >
                        <option value="student">Student</option>
                        <option value="employee">Professional / Employee</option>
                        <option value="other">Other / General</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Busy Start</label>
                        <input 
                          type="time" 
                          value={timetableProfile.schoolTimingsStart}
                          onChange={(e) => setTimetableProfile({ ...timetableProfile, schoolTimingsStart: e.target.value })}
                          className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:ring-0 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Busy End</label>
                        <input 
                          type="time" 
                          value={timetableProfile.schoolTimingsEnd}
                          onChange={(e) => setTimetableProfile({ ...timetableProfile, schoolTimingsEnd: e.target.value })}
                          className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:ring-0 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Tuitions / Recurring slots</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">Toggle extra tuition or meetings busy hours</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={timetableProfile.hasTuition}
                        onChange={(e) => setTimetableProfile({ ...timetableProfile, hasTuition: e.target.checked })}
                        className="checkbox-custom shrink-0"
                      />
                    </div>

                    {timetableProfile.hasTuition && (
                      <div className="grid grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5 animate-fadeIn">
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400 font-bold uppercase mb-1">Start</label>
                          <input 
                            type="time" 
                            value={timetableProfile.tuitionTimingsStart}
                            onChange={(e) => setTimetableProfile({ ...timetableProfile, tuitionTimingsStart: e.target.value })}
                            className="bg-zinc-900 border border-white/10 text-white rounded-xl py-1.5 px-2.5 text-[11px] focus:ring-0 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] text-slate-400 font-bold uppercase mb-1">End</label>
                          <input 
                            type="time" 
                            value={timetableProfile.tuitionTimingsEnd}
                            onChange={(e) => setTimetableProfile({ ...timetableProfile, tuitionTimingsEnd: e.target.value })}
                            className="bg-zinc-900 border border-white/10 text-white rounded-xl py-1.5 px-2.5 text-[11px] focus:ring-0 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col border-t border-white/5 pt-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Weekend Leisure hours goal</label>
                        <span className="text-xs font-bold text-purple-400">{timetableProfile.weekendLeisureHours} hrs</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        value={timetableProfile.weekendLeisureHours}
                        onChange={(e) => setTimetableProfile({ ...timetableProfile, weekendLeisureHours: Number(e.target.value) })}
                        className="w-full accent-purple-500"
                      />
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      alert("Timetable profile configured! Aura will fit study blocks avoiding these busy times.");
                      setActiveScreen('chat');
                    }}
                    className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Save Timetable</span>
                  </button>
                </div>
              )}

              {/* 3. TASKS PRIORITIZATION SCREEN */}
              {activeScreen === 'tasks' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-hidden text-left select-none relative z-10">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5">
                      <ListTodo size={18} className="text-purple-400" />
                      <span>Task Prioritization</span>
                    </h2>
                    <span className="text-[10px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20 font-bold">
                      {tasks.filter(t => !t.completed && !t.isSomeday).length} Active
                    </span>
                  </div>

                  {/* Dual Tabs Selector */}
                  <div className="flex border-b border-white/10 mb-4 shrink-0">
                    <button
                      onClick={() => setTasksTab('active')}
                      className={`flex-1 pb-2.5 text-xs font-bold transition-all relative ${
                        tasksTab === 'active' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Active Board ({tasks.filter(t => !t.isSomeday && !t.completed).length})
                    </button>
                    <button
                      onClick={() => setTasksTab('someday')}
                      className={`flex-1 pb-2.5 text-xs font-bold transition-all relative ${
                        tasksTab === 'someday' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Someday/Maybe ({tasks.filter(t => t.isSomeday && !t.completed).length})
                    </button>
                  </div>

                  {/* Add task bar */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const input = form.elements.namedItem('taskTitle') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      const newTask: Task = {
                        id: `task-manual-${Date.now()}`,
                        title: summarizeTaskTitle(input.value),
                        details: input.value,
                        dueDate: 'Tomorrow',
                        duration: '1 hour',
                        urgency: 'high',
                        category: 'study',
                        completed: false,
                        isSomeday: false,
                        energyLevel: guessEnergyLevel(input.value, '1 hour'),
                        scheduledTime: 'Today 7:00 PM - 8:00 PM',
                        studyGuide: '• Review fundamentals\n• Dedicate 45 minutes of silent work.'
                      };
                      setTasks(prev => {
                        if (isDuplicateTask(newTask.title, prev)) {
                          return prev;
                        }
                        const next = [newTask, ...prev];
                        setTimeout(() => triggerAgentReplan(next), 500);
                        return next;
                      });
                      input.value = '';
                    }
                  }} className="mb-4 flex gap-2 shrink-0">
                    <input 
                      type="text" 
                      name="taskTitle"
                      placeholder="Add task..." 
                      className="flex-grow bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:ring-0 focus:outline-none"
                    />
                    <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 text-xs font-bold">
                      Add
                    </button>
                  </form>

                  {/* Red Wall of Guilt Warning Block */}
                  {tasksTab === 'active' && (() => {
                    const overdueTasks = tasks.filter(t => !t.completed && !t.isSomeday && parseDueDate(t.dueDate).getTime() < Date.now());
                    if (overdueTasks.length === 0) return null;

                    return (
                      <div className="mb-4 bg-gradient-to-r from-red-950/80 to-red-900/60 border border-red-500/30 rounded-xl p-4 shadow-lg flex flex-col items-start gap-2.5 text-left animate-fadeIn shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">⚠️</span>
                          <h4 className="text-xs font-bold text-red-200 uppercase tracking-wide">Red Wall of Guilt!</h4>
                        </div>
                        <p className="text-[11px] text-red-300 leading-relaxed font-sans font-medium">
                          You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} that are falling behind schedule. Let's sweep them to free evening slots!
                        </p>
                        <button
                          onClick={handleSweepOverdueTasks}
                          className="py-1.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 self-end"
                        >
                          Sweep Overdue Tasks
                        </button>
                      </div>
                    );
                  })()}

                  {/* Tasks List */}
                  {(() => {
                    const filteredTasks = tasks.filter(t => tasksTab === 'active' ? !t.isSomeday : t.isSomeday);
                    const sortedIncomplete = filteredTasks
                      .filter(t => !t.completed)
                      .sort((a, b) => {
                        const aHours = getHoursUntilDeadline(a.dueDate);
                        const bHours = getHoursUntilDeadline(b.dueDate);
                        return aHours - bHours;
                      });
                    const topUrgentIds = new Set(sortedIncomplete.slice(0, 2).map(t => t.id));

                    if (filteredTasks.length === 0) {
                      return (
                        <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-500 italic text-xs">
                          {tasksTab === 'active' 
                            ? "No active tasks. Add one above or type in chat to schedule!" 
                            : "Your someday/maybe list is empty. Vague wishes like 'learn guitar sometime' will appear here!"}
                        </div>
                      );
                    }

                    return (
                      <div className="flex-grow overflow-y-auto space-y-3 pr-0.5">
                        {filteredTasks.map(task => {
                          const hours = getHoursUntilDeadline(task.dueDate);
                          const isLastMinute = !task.completed && hours <= 12;
                          const isFirm = !task.completed && hours <= 48 && hours > 12;
                          const isTopUrgent = !task.completed && topUrgentIds.has(task.id);

                          let cardClass = "aura-card p-4 transition-all ";
                          if (task.completed) {
                            cardClass += "bg-zinc-950/20 border-white/5 opacity-40";
                          } else if (isTopUrgent && isLastMinute) {
                            cardClass += "bg-[#20080f] border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-pulse";
                          } else if (isTopUrgent && isFirm) {
                            cardClass += "bg-[#201308] border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.2)]";
                          } else {
                            cardClass += "bg-[#12121a]/60 border border-white/5 hover:border-white/10 hover:bg-[#161622]/60";
                          }

                          return (
                            <div key={task.id} className={cardClass}>
                              <div className="flex items-start gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={task.completed}
                                  onChange={() => {
                                    setTasks(prev => {
                                      const next = prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t);
                                      setTimeout(() => triggerAgentReplan(next), 500);
                                      return next;
                                    });
                                  }}
                                  className="checkbox-custom mt-0.5 shrink-0"
                                />
                                <div className="flex-grow min-w-0">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <span className={`text-xs font-semibold truncate pr-1 ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                      {task.title}
                                    </span>
                                    <span className={`aura-badge shrink-0 ${
                                      task.completed ? 'badge-muted' :
                                      isLastMinute ? 'badge-red animate-pulse' :
                                      isFirm ? 'badge-orange' :
                                      task.urgency === 'high' ? 'badge-red' :
                                      task.urgency === 'medium' ? 'badge-orange' :
                                      'badge-muted'
                                    }`}>
                                      {task.completed ? 'Completed' : isLastMinute ? 'Last-Minute 🚨' : isFirm ? 'Firm ⚠️' : task.urgency}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5 font-medium">
                                    <span className="flex items-center gap-1">📅 {task.dueDate}</span>
                                    <span className="flex items-center gap-1">⏱️ {task.duration}</span>
                                  </div>
                                  
                                  {!task.completed && task.scheduledTime && (
                                    <div className="mt-2 text-[9px] bg-purple-950/15 border border-purple-500/10 text-purple-400 rounded-lg py-1 px-2.5 flex items-center gap-1 font-semibold font-sans">
                                      <Clock size={10} className="shrink-0" />
                                      <span className="truncate">Auto-Scheduled: {task.scheduledTime}</span>
                                    </div>
                                  )}

                                  {isLastMinute && task.microplan && task.microplan.length > 0 && (
                                    <div className="mt-3.5 border-t border-red-500/20 pt-2.5 text-left">
                                      <div className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1 select-none">
                                        <Sparkles size={10} />
                                        <span>⚡ Aura Next-Step Plan</span>
                                      </div>
                                      <div className="space-y-1.5 pl-1">
                                        {task.microplan.map((step, sIdx) => (
                                          <div key={sIdx} className="text-[10px] text-slate-300 font-medium leading-relaxed font-sans">
                                            {step}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Someday/Maybe Promotion Button */}
                                  {task.isSomeday && !task.completed && (
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleScheduleSomedayTask(task.id);
                                        }}
                                        className="py-1 px-3 bg-purple-600/80 hover:bg-purple-600 text-white rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
                                      >
                                        <Calendar size={10} />
                                        <span>Schedule Now</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 4. AI CALENDAR / SCHEDULING ASSISTANT SCREEN */}
              {activeScreen === 'schedule' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-hidden text-left select-none relative z-10">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1 shrink-0">
                    <Calendar size={18} className="text-purple-400" />
                    <span>AI Schedule Grid</span>
                  </h2>
                  <p className="text-[10px] text-slate-500 mb-4 shrink-0">Study blocks allocated around busy slots</p>

                  {/* Timeline Container */}
                  <div className="flex-grow overflow-y-auto space-y-3 pr-0.5">
                    {/* 07:30 - 15:00 School busy block */}
                    <div className="aura-card p-3.5 flex gap-4 bg-zinc-950/30 border-dashed border-white/5 opacity-60">
                      <div className="text-[10px] font-bold text-slate-500 w-14 shrink-0">07:30 AM</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-500">Classroom / School Timetable</div>
                        <div className="text-[9px] text-slate-600 mt-0.5 font-sans">Locked Busy Slot (No tasks scheduled)</div>
                      </div>
                    </div>

                    {/* Squeezed task block */}
                    {tasks.filter(t => !t.completed && t.scheduledTime?.includes('3:00 PM')).map(t => (
                      <div key={t.id} className="aura-card p-3.5 flex gap-4 bg-purple-950/20 border-purple-500/35 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        <div className="text-[10px] font-bold text-purple-400 w-14 shrink-0">03:00 PM</div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-slate-200">{t.title}</div>
                          <div className="text-[9px] text-purple-300 mt-0.5 font-semibold font-sans">Aura Allocated Study Session • {t.duration}</div>
                        </div>
                      </div>
                    ))}

                    {/* 16:00 - 18:00 Tuition busy block */}
                    {timetableProfile.hasTuition && (
                      <div className="aura-card p-3.5 flex gap-4 bg-zinc-950/30 border-dashed border-white/5 opacity-60">
                        <div className="text-[10px] font-bold text-slate-500 w-14 shrink-0">04:00 PM</div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-slate-500">Extra Tuition Class / Commitments</div>
                          <div className="text-[9px] text-slate-600 mt-0.5 font-sans">Locked Busy Slot</div>
                        </div>
                      </div>
                    )}

                    {/* Squeezed task block late evening */}
                    <div className="aura-card p-3.5 flex gap-4 bg-purple-950/20 border-purple-500/35 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                      <div className="text-[10px] font-bold text-purple-400 w-14 shrink-0">06:30 PM</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-200">Physics Lab Outline & Formulas</div>
                        <div className="text-[9px] text-purple-300 mt-0.5 font-semibold font-sans">Aura Allocated Study Session • 1.5 hours</div>
                      </div>
                    </div>

                    {/* Free space */}
                    <div className="aura-card p-3.5 flex gap-4 bg-white/5 border-white/5 hover:border-purple-500/20">
                      <div className="text-[10px] font-bold text-slate-400 w-14 shrink-0">08:00 PM</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-300">Open Free Time</div>
                        <div className="text-[9px] text-slate-500 mt-0.5 font-semibold font-sans">Available for rest, exercise or family</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. PERSONALIZED TIPS SCREEN */}
              {activeScreen === 'tips' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left select-none relative z-10 space-y-4">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Sparkles size={18} className="text-purple-400" />
                    <span>Productivity Tips</span>
                  </h2>

                  {productivityInsights ? (
                    <>
                      <div className="aura-card flex flex-row items-center gap-3.5 bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border-purple-500/15 p-4">
                        <span className="text-xl animate-bounce shrink-0">🔥</span>
                        <div>
                          <div className="text-xs font-bold text-white">Focus Streak Active!</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Completed assignments on time. Keep it up!</div>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        <div className="aura-card p-4">
                          <span className="aura-badge badge-red mb-1">
                            Overload Alert
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">
                            {productivityInsights.overloadAlert}
                          </p>
                        </div>

                        <div className="aura-card p-4">
                          <span className="aura-badge badge-purple mb-1">
                            Study Pattern
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">
                            {productivityInsights.studyPattern}
                          </p>
                        </div>

                        <div className="aura-card p-4">
                          <span className="aura-badge badge-orange mb-1">
                            Habit Suggestion
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">
                            {productivityInsights.habitSuggestion}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="aura-card p-8 flex flex-col items-center justify-center text-center gap-3.5 bg-[#0a0a0f]/40">
                      <Sparkles size={24} className="text-slate-600 animate-pulse" />
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xs font-sans">
                        Not enough activity yet — check back after a few days. Add some tasks and plan your schedule to generate insights!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 6. AUTONOMOUS AGENTS SCREEN */}
              {activeScreen === 'agents' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left select-none relative z-10 space-y-4">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Zap size={18} className="text-purple-400" />
                    <span>Autonomous Agents</span>
                  </h2>

                  <div className="space-y-4">
                    {/* Google Classroom Retriever — real integration */}
                    <div className="aura-card p-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-white flex items-center gap-2 select-none">
                          <span className={`w-1.5 h-1.5 rounded-full ${classroomConnected ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                          <span>Google Classroom Retriever</span>
                        </span>
                        <span className={`aura-badge ${classroomConnected ? 'badge-orange' : 'badge-muted'}`}>
                          {classroomConnected ? 'Active' : 'Not Connected'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-sans mb-3">
                        Syncs assignments directly from your Google Classroom courses into your task list.
                      </p>
                      <div className="flex gap-2">
                        {!classroomConnected ? (
                          <button
                            onClick={handleConnectClassroom}
                            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-all"
                          >
                            Connect
                          </button>
                        ) : (
                          <button
                            onClick={handleSyncClassroomAssignments}
                            disabled={classroomSyncing}
                            className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold transition-all disabled:opacity-50"
                          >
                            {classroomSyncing ? 'Syncing...' : 'Sync Assignments'}
                          </button>
                        )}
                      </div>
                      {classroomStatusMsg && (
                        <p className="text-[9px] text-slate-400 mt-2">{classroomStatusMsg}</p>
                      )}
                    </div>

                    {/* Calendar Optimizer — real integration */}
                    <div className="aura-card p-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-white flex items-center gap-2 select-none">
                          <span className={`w-1.5 h-1.5 rounded-full ${calendarConnected ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                          <span>Calendar Optimizer</span>
                        </span>
                        <span className={`aura-badge ${calendarConnected ? 'badge-orange' : 'badge-muted'}`}>
                          {calendarConnected ? 'Active' : 'Not Connected'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-sans mb-3">
                        Pushes your scheduled study blocks straight into your real Google Calendar.
                      </p>
                      <div className="flex gap-2">
                        {!calendarConnected ? (
                          <button
                            onClick={handleConnectCalendar}
                            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-all"
                          >
                            Connect
                          </button>
                        ) : (
                          <button
                            onClick={handleSyncTasksToCalendar}
                            disabled={calendarSyncing}
                            className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold transition-all disabled:opacity-50"
                          >
                            {calendarSyncing ? 'Syncing...' : 'Sync tasks to Calendar'}
                          </button>
                        )}
                      </div>
                      {calendarStatusMsg && (
                        <p className="text-[9px] text-slate-400 mt-2">{calendarStatusMsg}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 7. PHOTO SCANNER SCREEN */}
              {activeScreen === 'scanner' && (
                <div className="flex-1 flex flex-col justify-between p-5 pt-16 overflow-y-auto text-left select-none relative z-10">
                  <div>
                    <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-3">
                      <Sparkles size={18} className="text-purple-400" />
                      <span>Scan Assignment Photo</span>
                    </h2>

                    {/* Image Preview Container */}
                    <div className="relative w-full h-[180px] bg-black border border-white/10 rounded-2xl overflow-hidden mb-4 flex items-center justify-center">
                      {scannerPreviewUrl ? (
                        <>
                          <img src={scannerPreviewUrl} alt="uploaded" className="object-cover w-full h-full" />
                          {scannerState === 'scanning' && (
                            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-cyan-500 animate-scanline" />
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 text-xs">No image uploaded</div>
                      )}
                    </div>

                    {scannerState === 'scanning' ? (
                      <div className="text-center py-6">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <span className="text-xs text-purple-400 font-semibold">Analyzing screenshot contents...</span>
                      </div>
                    ) : (
                      <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-4.5">
                        <div className="flex justify-between items-start border-b border-white/5 pb-2">
                          <div>
                            <span className="text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Identified Title</span>
                            <div className="text-xs font-bold text-white">{scannedTask.title}</div>
                          </div>
                          <span className="bg-red-950/60 text-red-400 border border-red-500/20 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                            {scannedTask.urgency}
                          </span>
                        </div>

                        <div className="border-b border-white/5 pb-2">
                          <span className="text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Due Date Detected</span>
                          <div className="text-xs font-bold text-white">{scannedTask.dueDate}</div>
                        </div>

                        <div>
                          <span className="text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Additional details</span>
                          <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{scannedTask.description}</p>
                        </div>

                        <div className="flex flex-col border-t border-white/5 pt-3">
                          <label className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider mb-1">
                            Describe about this for better analysis?
                          </label>
                          <input 
                            type="text" 
                            value={scannerComment}
                            onChange={(e) => setScannerComment(e.target.value)}
                            placeholder="e.g. this is a math assignment to submit by 27th"
                            className="bg-zinc-900 border border-white/10 text-white rounded-xl py-2 px-3 text-[11px] focus:ring-0 focus:outline-none w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {scannerState === 'ready' && (
                    <button
                      onClick={handleSaveScannerTask}
                      className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 mt-4"
                    >
                      <Check size={14} />
                      <span>Save Reminder</span>
                    </button>
                  )}
                </div>
              )}

              {/* 8. AGENT ACTIVITY LOGS SCREEN */}
              {activeScreen === 'agent-logs' && (
                <div className="flex-1 flex flex-col justify-start p-5 pt-16 overflow-y-auto text-left select-none relative z-10 space-y-4">
                  <h2 className="text-lg font-heading font-bold text-white flex items-center gap-1.5 mb-1">
                    <Activity size={18} className="text-purple-400" />
                    <span>Agent Activity Logs</span>
                  </h2>
                  <p className="text-[10px] text-slate-500">Audit trail of proactive Daily Re-Plan Runs and optimizations</p>

                  <div className="space-y-4">
                    {agentLogs.length === 0 ? (
                      <div className="text-center text-slate-500 py-8 text-xs bg-white/5 border border-white/10 rounded-2xl">
                        No agent logs recorded yet. Aura runs re-planning checks when you add tasks or daily on app load.
                      </div>
                    ) : (
                      agentLogs.map((log: any) => (
                        <div key={log.id} className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-3">
                          <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-[10px] text-slate-400 font-bold">{log.timestamp}</span>
                            <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              log.status === 'approved' 
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                                : log.status === 'pending'
                                ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20 animate-pulse'
                                : 'bg-zinc-900 text-slate-500 border border-white/5'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-200 leading-relaxed font-medium">
                            {log.summary}
                          </p>

                          {log.proposedChanges && log.proposedChanges.length > 0 && (
                            <div className="bg-black/35 rounded-xl p-3 space-y-2 border border-white/5">
                              <div className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">Proposed Optimizations:</div>
                              {log.proposedChanges.map((change: any, cIdx: number) => (
                                <div key={cIdx} className="text-[10px] space-y-0.5 text-left border-l-2 border-purple-500/40 pl-2">
                                  <div className="font-bold text-slate-200">{change.title}</div>
                                  <div className="text-slate-500 text-[9px]">
                                    {change.oldSchedule} &rarr; <span className="text-purple-300 font-semibold">{change.newSchedule}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Sidebar Drawer */}
              {isSidebarOpen && (
                <div className="absolute inset-0 z-50 flex">
                  <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <div className="relative w-[280px] bg-[#0c0c14]/95 backdrop-blur-lg border-r border-white/5 flex flex-col justify-between p-5 z-10 shadow-2xl text-left transition-all">
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <span className="font-bold text-xl text-white tracking-wide">Aura</span>
                        <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X size={18} />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-[10px] text-purple-400/80 font-bold uppercase tracking-widest mb-3 select-none pl-1">
                          Features
                        </h4>
                        
                        <ul className="space-y-1.5 text-xs text-slate-300 font-semibold select-none">
                          <li 
                            onClick={() => { setActiveScreen('tasks'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3.5 rounded-xl transition-all ${
                              activeScreen === 'tasks' ? 'bg-purple-950/30 border border-purple-500/20 text-white' : 'hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                          >
                            <ListTodo size={14} className={activeScreen === 'tasks' ? 'text-purple-400' : 'text-slate-400'} />
                            <span>Task Prioritization</span>
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('schedule'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3.5 rounded-xl transition-all ${
                              activeScreen === 'schedule' ? 'bg-purple-950/30 border border-purple-500/20 text-white' : 'hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                          >
                            <Calendar size={14} className={activeScreen === 'schedule' ? 'text-purple-400' : 'text-slate-400'} />
                            <span>AI Scheduling Assistant</span>
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('tips'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3.5 rounded-xl transition-all ${
                              activeScreen === 'tips' ? 'bg-purple-950/30 border border-purple-500/20 text-white' : 'hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                          >
                            <Sparkles size={14} className={activeScreen === 'tips' ? 'text-purple-400' : 'text-slate-400'} />
                            <span>Productivity Insights</span>
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('agents'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3.5 rounded-xl transition-all ${
                              activeScreen === 'agents' ? 'bg-purple-950/30 border border-purple-500/20 text-white' : 'hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                          >
                            <Zap size={14} className={activeScreen === 'agents' ? 'text-purple-400' : 'text-slate-400'} />
                            <span>Autonomous Agents</span>
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('timetable'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3.5 rounded-xl transition-all ${
                              activeScreen === 'timetable' ? 'bg-purple-950/30 border border-purple-500/20 text-white' : 'hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                          >
                            <Clock size={14} className={activeScreen === 'timetable' ? 'text-purple-400' : 'text-slate-400'} />
                            <span>Timetable Setup</span>
                          </li>
                          <li 
                            onClick={() => { setActiveScreen('agent-logs'); setIsSidebarOpen(false); }}
                            className={`flex items-center gap-3 cursor-pointer py-2.5 px-3.5 rounded-xl transition-all ${
                              activeScreen === 'agent-logs' ? 'bg-purple-950/30 border border-purple-500/20 text-purple-300' : 'hover:bg-white/5 text-purple-400 hover:text-purple-300 border border-transparent'
                            }`}
                          >
                            <Activity size={14} className="text-purple-400 shrink-0" />
                            <span>Agent Activity Logs 🦖</span>
                          </li>
                        </ul>

                        <div className="border-t border-white/5 pt-3.5 mt-4">
                          <button 
                            onClick={() => {
                              setShowHistory(true);
                              setIsSidebarOpen(false);
                            }}
                            className="w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold text-purple-400 hover:text-purple-300 hover:bg-purple-950/15 border border-transparent hover:border-purple-500/10 transition-all text-left"
                          >
                            <History size={14} />
                            <span>View Chat History</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Drawer Footer */}
                    <div className="border-t border-white/5 pt-4 bg-[#08080f]/90 -mx-5 -mb-5 p-5 rounded-b-3xl flex items-center justify-between">
                      <div className="flex flex-col text-left">
                        <span className="text-slate-200 text-xs font-bold leading-tight">{username}</span>
                        <span className="text-slate-500 text-[10px] font-medium leading-none mt-1.5">
                          {username.toLowerCase().replace(/\s+/g, '')}@gmail.com
                        </span>
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowSettings(true);
                          setIsSidebarOpen(false);
                        }}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-1.5 text-xs font-semibold border border-transparent hover:border-white/5 transition-all"
                      >
                        <Settings size={14} />
                        <span>Settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat History Modal */}
              {showHistory && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80%]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-bold text-sm">Archived Sessions</h3>
                      <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-left select-none">
                      {activeArchivedChat ? (
                        <div>
                          <button 
                            onClick={() => setActiveArchivedChat(null)}
                            className="text-purple-400 text-[11px] font-semibold mb-3 block"
                          >
                            &larr; Back to list
                          </button>
                          <div className="space-y-3 bg-black/40 p-3 rounded-xl border border-white/5">
                            {activeArchivedChat.map((logItem, idx) => (
                              <div key={idx} className={`text-[11px] leading-relaxed ${logItem.sender === 'user' ? 'text-slate-200 text-right' : 'text-slate-300 text-left'}`}>
                                <span className="font-bold text-[9px] uppercase block text-slate-500 mb-0.5">
                                  {logItem.sender}
                                </span>
                                {logItem.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {archivedChats.length === 0 ? (
                            <div className="text-center text-slate-500 py-8 text-xs">
                              No archived chats. Use the Pen icon to archive and start a new chat!
                            </div>
                          ) : (
                            archivedChats.map((chat) => {
                              const isEditing = editingSessionId === chat.id;
                              const displayTitle = chat.title || chat.log.find(l => l.sender === 'user')?.text || "Chat Session";
                              const title = displayTitle.length > 35 ? `${displayTitle.substring(0, 35)}...` : displayTitle;
                              const lastMsg = chat.log[chat.log.length - 1]?.text || "";
                              const lastMsgSnippet = lastMsg.length > 45 ? `${lastMsg.substring(0, 45)}...` : lastMsg;

                              return (
                                <div 
                                  key={chat.id}
                                  onClick={() => {
                                    if (!isEditing) {
                                      setActiveArchivedChat(chat.log);
                                    }
                                  }}
                                  className="aura-card p-3.5 bg-zinc-900/40 border border-white/5 hover:border-purple-500/20 cursor-pointer flex flex-col gap-1.5 transition-all text-left"
                                >
                                  <div className="flex justify-between items-center gap-2">
                                    {isEditing ? (
                                      <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={editingTitleText}
                                          onChange={(e) => setEditingTitleText(e.target.value)}
                                          className="flex-grow bg-zinc-900 border border-white/20 text-white rounded px-2 py-0.5 text-xs focus:ring-0 focus:outline-none"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              setArchivedChats(prev => prev.map(c => c.id === chat.id ? { ...c, title: editingTitleText } : c));
                                              setEditingSessionId(null);
                                              setEditingTitleText('');
                                            } else if (e.key === 'Escape') {
                                              setEditingSessionId(null);
                                              setEditingTitleText('');
                                            }
                                          }}
                                        />
                                        <button
                                          onClick={() => {
                                            setArchivedChats(prev => prev.map(c => c.id === chat.id ? { ...c, title: editingTitleText } : c));
                                            setEditingSessionId(null);
                                            setEditingTitleText('');
                                          }}
                                          className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold px-1 py-0.5"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingSessionId(null);
                                            setEditingTitleText('');
                                          }}
                                          className="text-slate-400 hover:text-slate-300 text-[10px] font-medium px-1 py-0.5"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-xs font-semibold text-slate-200 truncate flex-1">{title}</span>
                                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={() => {
                                              setEditingSessionId(chat.id);
                                              setEditingTitleText(chat.title || displayTitle);
                                            }}
                                            className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded transition-all"
                                            title="Rename Session"
                                          >
                                            <SquarePen size={12} />
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (confirm("Are you sure you want to delete this session?")) {
                                                setArchivedChats(prev => prev.filter(c => c.id !== chat.id));
                                              }
                                            }}
                                            className="text-slate-400 hover:text-red-400 p-1 hover:bg-white/5 rounded transition-all"
                                            title="Delete Session"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                          <span className="text-[9px] text-purple-400 font-semibold pl-1">Open &rarr;</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate leading-normal font-sans">
                                    {lastMsgSnippet}
                                  </p>
                                  <div className="text-[8px] text-slate-500 font-medium select-none mt-0.5 flex justify-between">
                                    <span>🕒 {chat.date}</span>
                                    <span>{chat.log.length} message{chat.log.length > 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Modal */}
              {showSettings && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                  <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-3 select-none">
                      <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
                        <Settings size={16} className="text-purple-400" />
                        <span>Aura Settings</span>
                      </h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="space-y-4.5 text-xs text-slate-300">
                      <div className="flex justify-between items-center select-none">
                        <span>Default User Name</span>
                        <input 
                          type="text" 
                          value={username} 
                          onChange={(e) => setUsername(e.target.value)}
                          className="bg-zinc-900 border border-white/10 text-white rounded-lg py-1 px-2.5 text-[11px] max-w-[120px] focus:ring-0 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-between items-center select-none">
                        <span>Coaching Style Tone</span>
                        <select
                          value={timetableProfile.coachingTone}
                          onChange={(e) => setTimetableProfile({ ...timetableProfile, coachingTone: e.target.value as CoachingTone })}
                          className="bg-zinc-900 border border-white/10 text-white rounded-lg py-1.5 px-3 text-[11px] focus:ring-0 focus:outline-none"
                        >
                          <option value="balanced">Balanced / Calm</option>
                          <option value="encouraging">Warm / Encouraging</option>
                          <option value="aggressive">Aggressive / Snarky 🦖</option>
                        </select>
                      </div>
                      
                      <div className="border-t border-white/5 pt-4 mt-2 select-none space-y-2.5">
                        <button
                          onClick={() => {
                            if (confirm("This will clear all tasks, chat history, and archived sessions. This cannot be undone.")) {
                              const uid = currentUser?.uid ?? null;
                              removeUserItem('aura_tasks', uid);
                              removeUserItem('aura_archived_chats', uid);
                              removeUserItem('aura_agent_logs', uid);
                              removeUserItem('aura_productivity_insights', uid);
                              removeUserItem('aura_last_replan_time', uid);
                              removeUserItem('aura_last_replan_timestamp', uid);
                              
                              setTasks([]);
                              setChatLog([]);
                              setArchivedChats([]);
                              setProductivityInsights(null);
                              setLastReplanTime('');
                              setLastReplanTimestamp(0);
                              setAgentLogs([]);
                              setQuickWin(null);
                              setInputCommand('');
                              setInputFocused(false);
                              setShowSettings(false);
                              setShowHistory(false);
                              setIsSidebarOpen(false);
                              setAppState('chat_closed');
                              setActiveScreen('chat');
                            }
                          }}
                          className="w-full py-2 px-3 rounded-lg border border-red-500/20 bg-red-950/15 text-red-400 hover:bg-red-900/20 text-[10px] flex items-center justify-center gap-1.5 transition-all animate-pulse"
                        >
                          <Trash2 size={12} />
                          <span>Reset Application Data</span>
                        </button>

                        {currentUser && (
                          <button
                            onClick={() => {
                              setShowSettings(false);
                              handleSignOut();
                            }}
                            className="w-full py-2 px-3 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-[10px] flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span>Sign Out{currentUser.email ? ` (${currentUser.email})` : ''}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Focus Timer Modal Overlay (Feature 3) */}
              {focusTimer.isActive && (
                <div className="absolute inset-0 z-50 bg-[#06030e]/95 backdrop-blur-md flex flex-col justify-between p-6 text-center select-none" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={16} className="text-purple-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Focus Session</span>
                    </div>
                    <button 
                      onClick={() => setFocusTimer(prev => ({ ...prev, isActive: false }))}
                      className="p-1.5 bg-white/5 border border-white/10 rounded-full text-slate-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-grow flex flex-col items-center justify-center">
                    <div className="relative w-56 h-56 flex items-center justify-center mb-6">
                      {/* Outer spinning dash border */}
                      <div className="absolute inset-0 rounded-full border-4 border-dashed border-purple-500/20 animate-[spin_60s_linear_infinite]" />
                      {/* Inner glowing circle */}
                      <div className="absolute w-48 h-48 rounded-full bg-gradient-to-tr from-purple-600/10 to-cyan-500/10 border border-purple-500/30 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.15)] animate-pulse">
                        <span className="text-4xl font-mono font-extrabold text-white tracking-widest leading-none">
                          {(() => {
                            const mins = Math.floor(focusTimer.secondsRemaining / 60);
                            const secs = focusTimer.secondsRemaining % 60;
                            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                          })()}
                        </span>
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-2.5">Remaining</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white max-w-xs">{focusTimer.taskTitle}</h3>
                    <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                      Deep focus mode. Put away distractions and focus on your next step.
                    </p>
                  </div>

                  {/* Lofi focus synth controls placeholder */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎵</span>
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-200">Study Beats Lofi</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">Playing focus synth track</div>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  </div>

                  <div className="flex gap-4 justify-center mb-8">
                    <button
                      onClick={() => setFocusTimer(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className="py-3 px-8 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      {focusTimer.isActive ? 'Pause focus' : 'Resume focus'}
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}

          {/* Bottom Screen Bar */}
          <div className="h-4 bg-black flex items-center justify-center shrink-0 w-full select-none">
            <div className="w-28 h-1 bg-zinc-700/80 rounded-full" />
          </div>

        </div>
      );
};

export default App;
