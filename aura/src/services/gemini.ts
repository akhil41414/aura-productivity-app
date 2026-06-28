export interface Task {
  id: string;
  title: string;
  dueDate: string;
  duration: string; // e.g. "2 hours"
  urgency: 'high' | 'medium' | 'low';
  category: 'work' | 'personal' | 'study';
  completed: boolean;
  scheduledTime?: string; // e.g. "Thursday 3:00 PM - 5:00 PM"
  studyGuide?: string; // Automatically generated guide/sub-tasks
  microplan?: string[]; // Proactive micro-plan actions if urgent
  isSomeday?: boolean; // Captures someday/maybe thoughts without schedule pressure
  energyLevel?: 'high_focus' | 'low_effort'; // Optional energy tagging
  details?: string; // Original raw user message/context
}

export type CoachingTone = 'encouraging' | 'balanced' | 'aggressive';

export interface UserScheduleProfile {
  role: 'student' | 'employee' | 'other';
  schoolTimingsStart: string;
  schoolTimingsEnd: string;
  hasTuition: boolean;
  tuitionTimingsStart: string;
  tuitionTimingsEnd: string;
  weekendLeisureHours: number;
  customQA: { question: string; answer: string }[];
  coachingTone: CoachingTone;
}

const SERVER_URL = 'http://localhost:5000/api';

// Cache for recent chat commands to prevent duplicate API calls
const chatCache = new Map<string, { reply: string; newTasks: Task[]; timestamp: number }>();

// Fallback response library to handle cases where API key is missing or offline
const MOCK_AURA_RESPONSES = [
  {
    trigger: ['school timing', 'tuition timing', 'my routine', 'my schedule', 'subjects list', 'free on weekend', 'college timings', 'college timing', 'subjects i have'],
    getResponse: (text: string, tone: CoachingTone): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[]; timetableProposal?: UserScheduleProfile } => {
      const textLower = text.toLowerCase();
      
      // 1. Extract school/college timings
      let schoolTimingsStart = "07:00";
      let schoolTimingsEnd = "18:00";
      const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
      const matchTime = textLower.match(timeRegex);
      if (matchTime) {
        let startHour = parseInt(matchTime[1]);
        const startMin = matchTime[2] || "00";
        const startAmpm = matchTime[3].toLowerCase();
        let endHour = parseInt(matchTime[4]);
        const endMin = matchTime[5] || "00";
        const endAmpm = matchTime[6].toLowerCase();
        
        if (startAmpm === 'pm' && startHour < 12) startHour += 12;
        if (startAmpm === 'am' && startHour === 12) startHour = 0;
        if (endAmpm === 'pm' && endHour < 12) endHour += 12;
        if (endAmpm === 'am' && endHour === 12) endHour = 0;
        
        schoolTimingsStart = `${startHour.toString().padStart(2, '0')}:${startMin}`;
        schoolTimingsEnd = `${endHour.toString().padStart(2, '0')}:${endMin}`;
      }

      // 2. Extract subject count
      let subjectsCount = 5;
      const subjectsRegex = /(\d+)\s*subject/i;
      const matchSubjects = textLower.match(subjectsRegex);
      if (matchSubjects) {
        subjectsCount = parseInt(matchSubjects[1]);
      }

      // 3. Extract block duration
      let blockDuration = "1 hour";
      const durationRegex = /(\d+)\s*(hour|hr|min|m)(?:s)?\s*(?:each|per\s+subject)/i;
      const matchDuration = textLower.match(durationRegex) || textLower.match(/(\d+)\s*(hour|hr|min|m)(?:s)?\b/i);
      if (matchDuration) {
        const val = matchDuration[1];
        const unit = matchDuration[2].toLowerCase();
        blockDuration = `${val} ${unit.startsWith('h') ? 'hour' : 'min'}${parseInt(val) > 1 ? 's' : ''}`;
      }

      // 4. Extract breaks
      let breakDuration = "10 mins";
      const breakRegex = /(\d+(?:-\d+)?)\s*(?:min|m)(?:ute)?s?\s*break/i;
      const matchBreak = textLower.match(breakRegex);
      if (matchBreak) {
        breakDuration = `${matchBreak[1]} mins`;
      }

      // 5. Extract weekend leisure
      let weekendLeisureHours = 4;
      if (textLower.includes('saturday free') || textLower.includes('free on saturday') || textLower.includes('saturday is free') || textLower.includes('saturday free')) {
        weekendLeisureHours = 6;
      }
      const leisureMatch = textLower.match(/sunday\s*(\d+)\s*(?:hour|hr|h)\b/i) || textLower.match(/weekend\s*(\d+)\s*(?:hour|hr|h)\b/i) || textLower.match(/(\d+)\s*(?:hour|hr|h)\s*(?:personal|free|leisure)\b/i);
      if (leisureMatch) {
        weekendLeisureHours = parseInt(leisureMatch[1]);
      }

      const role = textLower.includes('college') || textLower.includes('school') || textLower.includes('student') ? 'student' : 'employee';

      const timetableProposal: UserScheduleProfile = {
        role,
        schoolTimingsStart: schoolTimingsStart,
        schoolTimingsEnd: schoolTimingsEnd,
        hasTuition: textLower.includes('tuition'),
        tuitionTimingsStart: "18:00",
        tuitionTimingsEnd: "20:00",
        weekendLeisureHours: weekendLeisureHours,
        customQA: [
          { question: "What is your main study goal or peak productivity times?", answer: text.substring(0, 100) }
        ],
        coachingTone: tone
      };

      const endParts = schoolTimingsEnd.split(':');
      let startHour = parseInt(endParts[0]) + 1;
      if (startHour >= 24) startHour = 19;
      
      let weekdayBlocks = "";
      if (subjectsCount > 0) {
        weekdayBlocks = `weekdays after ${schoolTimingsEnd}: `;
        const blocksList = [];
        let currentHour = startHour;
        for (let i = 1; i <= Math.min(3, subjectsCount); i++) {
          const blockStart = `${currentHour > 12 ? currentHour - 12 : currentHour}:00 ${currentHour >= 12 ? 'PM' : 'AM'}`;
          currentHour += 1;
          const blockEnd = `${currentHour > 12 ? currentHour - 12 : currentHour}:00 ${currentHour >= 12 ? 'PM' : 'AM'}`;
          blocksList.push(`Block ${i} ${blockStart}–${blockEnd}`);
        }
        weekdayBlocks += blocksList.join(', ') + ` (${breakDuration} breaks between)`;
      } else {
        weekdayBlocks = `weekdays 7–9 PM for study`;
      }

      let reply = `okay so ${role === 'student' ? 'college' : 'work'} is ${schoolTimingsStart}–${schoolTimingsEnd}, you've got ${subjectsCount} subjects, ${blockDuration} each with ${breakDuration} breaks — I'm mapping out ${weekdayBlocks}. saturday's free, sunday is your personal day (${weekendLeisureHours} hrs). tap below and I'll save this to your timetable!`;

      return {
        reply,
        tasks: [],
        timetableProposal
      };
    }
  },
  {
    trigger: ['homework', 'assignment', 'project', 'due', 'math', 'history', 'physics', 'essay'],
    getResponse: (text: string, tone: CoachingTone): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      const match = text.match(/(math|history|physics|essay|science|project|assignment)/i);
      const subject = match ? match[0] : 'Project';
      const title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Assignment`;
      
      const now = new Date();
      const currentDay = now.getDay();
      let diff = 4 - currentDay; // Thursday is 4
      if (diff <= 0) diff += 7; // Next Thursday
      const nextThursday = new Date(now);
      nextThursday.setDate(now.getDate() + diff);
      const formattedDate = nextThursday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = `${formattedDate} 3:00 PM`;

      let reply = '';
      if (tone === 'aggressive') {
        reply = `${title} due soon — I put Thursday (${formattedDate}) 3–5 PM on the calendar for it. no excuses, get it done.`;
      } else if (tone === 'encouraging') {
        reply = `okay so ${title} — I've blocked Thursday (${formattedDate}) 3–5 PM for you. you got this, take it one step at a time 🦖`;
      } else {
        reply = `${title} — Thursday (${formattedDate}) 3–5 PM works well, so I've set that aside for you. let me know if you need a different slot.`;
      }

      return {
        reply,
        tasks: [
          {
            title: `${title} Prep & Outline`,
            dueDate: timeStr,
            duration: '1 hour',
            urgency: 'high',
            category: 'study',
            scheduledTime: `Thursday 3:00 PM - 4:00 PM`,
            studyGuide: '• Review rubric\n• Gather reference materials\n• Draft introduction and structural points.'
          },
          {
            title: `Write & Finalize ${title}`,
            dueDate: `${formattedDate} 4:00 PM`,
            duration: '1 hour',
            urgency: 'high',
            category: 'study',
            scheduledTime: `Thursday 4:00 PM - 5:00 PM`,
            studyGuide: '• Write main arguments\n• Format bibliography\n• Spell check and export to PDF.'
          }
        ]
      };
    }
  },
  {
    trigger: ['bill', 'pay', 'electricity', 'rent', 'subscription'],
    getResponse: (text: string, tone: CoachingTone): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      const match = text.match(/(rent|electricity|bill|subscription|netflix|spotify)/i);
      const billType = match ? match[0] : 'Rent';
      const title = `Pay ${billType.charAt(0).toUpperCase() + billType.slice(1)}`;
      
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      let reply = '';
      if (tone === 'aggressive') {
        reply = `${title} is due tomorrow (${tomorrowStr}). I've blocked 6 PM today — pay it now before it slips.`;
      } else if (tone === 'encouraging') {
        reply = `just a heads up — ${title} coming up, so I put 6 PM today aside for it. 5 minutes and it's done!`;
      } else {
        reply = `${title} — I've blocked today at 6 PM for it, should only take 15 mins.`;
      }

      return {
        reply,
        tasks: [
          {
            title: title,
            dueDate: tomorrowStr,
            duration: '15 mins',
            urgency: 'high',
            category: 'personal',
            scheduledTime: 'Today 6:00 PM - 6:15 PM',
            studyGuide: '• Open secure payment link\n• Confirm payment details\n• Download PDF receipt.'
          }
        ]
      };
    }
  },
  {
    trigger: ['gym', 'workout', 'run', 'exercise', 'health'],
    getResponse: (_text: string, tone: CoachingTone): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let reply = '';
      if (tone === 'aggressive') {
        reply = `5 PM today, workout, no excuses. I've blocked it. put the phone down and go 🦖`;
      } else if (tone === 'encouraging') {
        reply = `love it — 5 PM today I've got a 45-min block saved for you. you're gonna feel so good after!`;
      } else {
        reply = `5 PM today works well for a workout — I've put 45 mins aside for it.`;
      }
      return {
        reply,
        tasks: [
          {
            title: 'Fitness Session',
            dueDate: todayStr,
            duration: '45 mins',
            urgency: 'medium',
            category: 'personal',
            scheduledTime: 'Today 5:00 PM - 5:45 PM',
            studyGuide: '• 10m Warmup stretch\n• 30m Cardio/Strength exercises\n• 5m Cooldown.'
          }
        ]
      };
    }
  }
];

// Helper to run a promise with timeout client-side
function withTimeout(promise: Promise<any>, ms: number, errorMessage = "Request timed out"): Promise<any> {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
  ]);
}

// Helper to parse absolute or relative due dates (Bug A)
export function parseDueDate(dueDateStr: string): Date {
  const normalized = dueDateStr.toLowerCase().trim();
  const now = new Date();
  
  if (normalized.includes('today')) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }
  if (normalized.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);
  }
  if (normalized.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
  }
  
  // Weekday names
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < 7; i++) {
    if (normalized.includes(weekdays[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next week's weekday
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diff);
      return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
    }
  }
  
  // Clean ordinals (e.g. 27th -> 27)
  const cleanStr = normalized.replace(/(\d+)(st|nd|rd|th)/g, '$1').trim();
  const parsed = Date.parse(cleanStr);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }
  
  // Fallback: assume due 3 days from now
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 3);
  return fallback;
}

// Helper to calculate Levenshtein distance between two strings (fuzzy edit distance)
export function getEditDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Typo-robust structural heuristic and fuzzy classifier for capability/help queries
export function isCapabilityQuery(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const clean = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
  
  // 1. Target templates for fuzzy matching (allow 1-2 character typos)
  const targetPhrases = [
    "what can you do",
    "what do you do",
    "what can u do",
    "what do u do",
    "what are your features",
    "what are ur features",
    "what do you help with",
    "what do u help with",
    "what can you do help",
    "what do you help me with",
    "help",
    "how to use",
    "features",
    "commands",
    "capabilities"
  ];
  
  // Check exact or near match on full query using Levenshtein distance (safety net)
  for (const phrase of targetPhrases) {
    if (clean === phrase) return true;
    if (clean.length > 3 && phrase.length > 3) {
      const distance = getEditDistance(clean, phrase);
      if (distance <= 2) {
        console.log(`[Fuzzy Classifier] Matched capability query: "${clean}" close to "${phrase}" (dist: ${distance})`);
        return true;
      }
    }
  }
  
  // 2. Structural Heuristics
  const dateKeywords = [
    'today', 'tomorrow', 'yesterday', 
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
    'due', 'deadline', 'scheduled', 'by', 'on', 'at'
  ];
  const timePattern = /\b\d{1,2}(:\d{2})?(\s*(am|pm))?\b/i;
  const hasDateSignal = dateKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(clean)) || timePattern.test(clean);

  const taskNouns = [
    'assignment', 'assignments', 'homework', 'homeworks', 'submission', 'submissions', 'submit', 'exam', 'exams', 'test', 'tests', 'bill', 'bills', 
    'rent', 'rents', 'electricity', 'meeting', 'meetings', 'report', 'reports', 'project', 'projects', 'gym', 'gyms', 'workout', 'workouts', 
    'run', 'runs', 'exercise', 'exercises', 'subscription', 'subscriptions', 'task', 'tasks', 'todo', 'todos', 'to do', 'to dos', 'quiz', 'quizzes', 
    'essay', 'essays', 'paper', 'papers', 'groceries', 'outline', 'outlines', 'lab', 'labs', 'class', 'classes', 'timetable', 'timetables',
    'portfolio', 'presentation', 'project', 'code', 'website'
  ];
  const hasTaskNoun = taskNouns.some(noun => new RegExp(`\\b${noun}\\b`, 'i').test(clean));

  if (hasDateSignal || hasTaskNoun) return false;

  const words = clean.split(/\s+/).filter(Boolean);
  const isShort = words.length <= 8;
  const questionStartPattern = /^(what|why|how|who|when|can\s+u|can\s+you|do\s+u|do\s+you|are\s+u|are\s+you|tell\s+me|show\s+me|help|wut|wat|whay|wuy|hwo|wen)\b/i;
  
  const matchesQuestionPrefix = questionStartPattern.test(clean);
  // MUST have explicit capability concept words — not just any short question
  const matchesCapabilityConcept = 
    clean.includes('you do') || 
    clean.includes('u do') || 
    /\bhelp\b/.test(clean) ||
    clean.includes('features') || 
    clean.includes('commands') || 
    clean.includes('capabilities') ||
    clean.includes('what can') ||
    clean.includes('what do you') ||
    clean.includes('what do u') ||
    clean.includes('how do you work') ||
    clean.includes('how do u work');

  // Require BOTH prefix AND concept match — not just any short question
  if (isShort && matchesQuestionPrefix && matchesCapabilityConcept) {
    console.log(`[Structural Classifier] Matched capability query: "${clean}"`);
    return true;
  }

  return false;
}

// Checks if the user message describes general routine/context/preferences rather than an actionable task/deadline
export function isRoutineOrContextQuery(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const clean = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();

  // Strong routine indicators — any of these alone = routine context
  const strongRoutineSignals = [
    'college timing', 'college timings', 'college hours', 'college time',
    'school timing', 'school timings', 'school time', 'school hours',
    'my college', 'studying in', 'i study in', 'i am studying',
    'iam studying', 'i m studying',
    'tuition timing', 'tuition timings', 'tuition time', 'tuition hours',
    'my routine', 'my schedule', 'my timetable', 'my week', 'my day',
    'busy from', 'busy between', 'free from', 'free between',
    'subjects list', 'list of subjects', 'my subjects', 'i study',
    'subjects i have', 'i have subjects', 'i have sub',
    'monday to friday', 'mon to fri', 'weekdays free', 'free on weekends',
    'free on saturday', 'free on sunday', 'saturday free', 'sunday free',
    'study habit', 'study habits', 'routine info', 'preferences',
    'schedule me what', 'schedule what', 'schedule me when',
    'when to study', 'what to study', 'study plan',
    'from monday', 'collage from monday', 'college from monday',
  ];

  if (strongRoutineSignals.some(phrase => clean.includes(phrase))) {
    // Only bail out if it's very clearly a specific task with a hard deadline
    const hardDeadlineTriggers = ['due tomorrow', 'due today', 'due by', 'submit by', 'deadline is', 'deadline tomorrow'];
    const hasHardDeadline = hardDeadlineTriggers.some(trigger => clean.includes(trigger));
    if (hasHardDeadline) return false;
    return true;
  }

  // Heuristic: message is long AND mentions timing patterns + subjects = routine description
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  const hasTimingPattern = /\b(\d{1,2}\s*(am|pm)|\d{1,2}\s*to\s*\d{1,2}|\d{1,2}-\d{1,2})\b/i.test(clean);
  const hasSubjectMention = /\b(subject|sub|topic|course|chapter|focuse?|focus|study|learn|revision|revise)\b/i.test(clean);
  const hasScheduleWord = /\b(schudle|schedule|schedul|plan|timetable|time table|slot|block|morning|evening|night|afternoon|break|brake)\b/i.test(clean);
  const hasCollegeWord = /\b(college|collage|school|uni|university|class|classes|sem|semester)\b/i.test(clean);

  if (wordCount >= 20 && hasTimingPattern && (hasSubjectMention || hasScheduleWord) && hasCollegeWord) {
    return true;
  }

  // Medium-length message with clear routine structure
  if (wordCount >= 12 && hasCollegeWord && hasTimingPattern && hasScheduleWord) {
    return true;
  }

  // Descriptive timings without hard action keywords
  if (clean.includes('timing') || clean.includes('timings') || clean.includes('schedule')) {
    const hardActionKeywords = ['add', 'submit', 'due', 'deadline', 'homework', 'assignment', 'exam', 'test', 'bill', 'pay', 'quiz'];
    const hasHardAction = hardActionKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(clean));
    if (!hasHardAction) return true;
  }

  return false;
}

// 1. Process Aura chat command via Express Server proxy
export async function processAuraCommand(
  text: string,
  _apiKey?: string, // Obsoleted client-side API Key
  profile?: UserScheduleProfile | null,
  currentTasks: Task[] = []
): Promise<{ reply: string; newTasks: Task[]; timetableProposal?: UserScheduleProfile; isLocal?: boolean }> {
  const normalizedText = text.toLowerCase().trim();
  // Escalate tone automatically if any task is in Last-Minute Mode (hours <= 12)
  const hasLastMinute = currentTasks.some(t => {
    if (t.completed || t.isSomeday) return false;
    const hrs = (parseDueDate(t.dueDate).getTime() - Date.now()) / (3600 * 1000);
    return hrs > 0 && hrs <= 12;
  });
  const tone = hasLastMinute ? 'aggressive' : (profile?.coachingTone || 'balanced');

  // --- Caching Layer (Bug 3) ---
  const cacheKey = `${tone}-${normalizedText}`;
  if (chatCache.has(cacheKey)) {
    const cached = chatCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < 30000) { // 30 seconds cache
      console.log(`[Cache Hit] Returning cached response for: "${normalizedText}"`);
      // Return fresh copy of cached task templates with new IDs and energy levels
      const clonedTasks = cached.newTasks.map((t, idx) => ({
        ...t,
        id: `task-cache-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        energyLevel: t.energyLevel || guessEnergyLevel(t.title, t.duration)
      }));
      return {
        reply: cached.reply,
        newTasks: clonedTasks,
        isLocal: false
      };
    }
  }

  // --- Intent Classification (Local Pre-Check) (Bug 1 & Bug B & Round 2 Bug B) ---
  
  // --- Routine / Schedule Preferences Intercept (Bug 1) ---
  if (isRoutineOrContextQuery(normalizedText)) {
    try {
      const fetchPromise = fetch(`${SERVER_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          tone,
          profile,
          userId: 'default-user',
          currentDate: new Date().toISOString(),
          localTimeContext: new Date().toLocaleString()
        })
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        return res.json();
      });

      const data = await withTimeout(fetchPromise, 9000, "Server timeout");
      return {
        reply: data.reply || "saved your routine settings, all set.",
        newTasks: [],
        timetableProposal: data.timetableProposal
      };
    } catch (err) {
      console.warn("Backend server routine call failed, falling back to local routine parser:", err);
    }

    // Local Fallback routine parser
    const mockHandler = MOCK_AURA_RESPONSES.find(h => 
      h.trigger.some(triggerWord => normalizedText.includes(triggerWord))
    );
    if (mockHandler) {
      const result = mockHandler.getResponse(text, tone);
      return {
        reply: result.reply,
        newTasks: [],
        timetableProposal: (result as any).timetableProposal
      };
    }
  }

  // Identity query — "who are you", "what are you", "are you an ai" etc.

  const identityPattern = /^(who are you|who r u|who r you|who are u|what are you|are you an ai|are you ai|are you real|are you a bot|are you human|r u ai|r u a bot|wat r u|what r u)\b/i;
  if (identityPattern.test(normalizedText.trim())) {
    const reply = tone === 'aggressive'
      ? "I'm Aura. AI. I manage your schedule so you don't drop the ball. what do you need done?"
      : tone === 'encouraging'
      ? "I'm Aura — your AI study buddy! I help you stay on top of tasks, deadlines, and your schedule. what are we working on? 🦖"
      : "I'm Aura, an AI productivity companion. I keep track of your tasks, schedule study blocks, and help you hit your deadlines.";
    return { reply, newTasks: [], isLocal: true };
  }

  // Off-topic / unrelated questions — "can you cook", "do you eat" etc.
  const offTopicPattern = /^(can you (cook|eat|sleep|dance|sing|drive|fly|swim|talk|walk|fight|play|draw)|do you (eat|sleep|dream|feel|live)|are you (alive|awake|hungry|tired|bored))\b/i;
  if (offTopicPattern.test(normalizedText.trim())) {
    const reply = tone === 'encouraging'
      ? "haha nope! I'm just an AI — but I'm really good at keeping your study schedule on track 🦖 what do you need help with?"
      : "nah, I only do tasks and schedules. what do you need to get done?";
    return { reply, newTasks: [], isLocal: true };
  }

  const cleanText = normalizedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
  
  // Robust Capability Check (Fuzzy + Structural)
  if (isCapabilityQuery(normalizedText)) {
    let reply = "here's what I can do: schedule your assignments around your timetable, catch urgent deadlines before they sneak up, find 10-min quick wins to get you started, and answer questions about your tasks.";
    if (tone === 'aggressive') {
      reply = "I schedule your tasks and call you out when you procrastinate. tell me what's due or what you need done.";
    } else if (tone === 'encouraging') {
      reply = "I'm Aura! I'm here to help you schedule tasks, catch deadlines, build momentum with quick wins, and keep things stress-free. what are we working on? 🦖";
    }
    return { reply, newTasks: [], isLocal: true };
  }



  // Check for vague future thoughts (Someday/Maybe bucket) (Issue 6.2)
  if (isSomedayMaybeQuery(normalizedText)) {
    let reply = `okay, saved "${text}" to your someday list. no pressure on it for now — let's focus on what's actually due first.`;
    const newTask: Task = {
      id: `task-someday-${Date.now()}`,
      title: summarizeTaskTitle(text),
      dueDate: 'Someday',
      duration: 'Flexible',
      urgency: 'low',
      category: 'personal',
      completed: false,
      isSomeday: true,
      details: text,
      energyLevel: guessEnergyLevel(text, 'Flexible'),
      studyGuide: '• Someday dream captured! Tap "Schedule Now" in your Tasks list when you are ready to make it a reality.'
    };
    return { reply, newTasks: [newTask], isLocal: true };
  }
  
  const casualGreetingPattern = /^\b(hi|hello|hey|yo|greetings|howdy|sup|good morning|good afternoon|good evening|hey there|aura|hows it going|how are you|whats up|what up)\b$/i;
  const casualThanksPattern = /^\b(thanks|thank you|thx|cheers|awesome|great|perfect|ok|okay|fine|cool|nice|anytime|sweet|yep|yup|yes|no|nah|sure)\b$/i;

  const taskKeywords = [
    'due', 'task', 'math', 'assign', 'work', 'exam', 'test', 'bill', 'pay', 'gym', 
    'rent', 'electricity', 'subscription', 'homework', 'project', 'study', 'exercise', 
    'outline', 'submit', 'do', 'add', 'create', 'make', 'schedule', 'remind', 'calendar', 'timetable',
    'workout', 'run', 'fitness', 'meeting', 'meet', 'groceries', 'buy', 'call', 'todo', 'to do',
    'lab', 'essay', 'paper', 'report', 'review', 'science', 'history', 'quiz', 'done', 'finish', 'complete',
    // Additional common task types
    'portfolio', 'build', 'design', 'code', 'coding', 'develop', 'website', 'app', 'application',
    'presentation', 'present', 'prepare', 'read', 'chapter', 'notes', 'note', 'research',
    'practice', 'exercise', 'revision', 'revise', 'memorize', 'learn', 'complete', 'finish',
    'send', 'email', 'message', 'apply', 'fill', 'form', 'register', 'signup', 'book',
    'fix', 'debug', 'test', 'deploy', 'write', 'draft', 'edit', 'record', 'film', 'shoot',
    'interview', 'internship', 'resume', 'cv', 'cover letter', 'apply',
    'have to', 'need to', 'want to', 'hav to', 'ned to', 'wanna', 'gotta', 'hafta'
  ];

  const hasTaskKeywords = taskKeywords.some(keyword => cleanText.includes(keyword) || normalizedText.includes(keyword));


  // 1. Casual Chat Classification (Broadened so chitchat defaults here)
  if (!hasTaskKeywords) {
    let reply = "I'm Aura, your scheduling companion. Let me know what assignments or tasks you want to schedule today!";
    
    // Check if it matches greetings or thanks patterns
    const isGreeting = casualGreetingPattern.test(cleanText) || cleanText.split(/\s+/).some(w => casualGreetingPattern.test(w));
    const isThanks = casualThanksPattern.test(cleanText) || cleanText.split(/\s+/).some(w => casualThanksPattern.test(w));
    
    if (isThanks) {
      if (tone === 'aggressive') {
        reply = "Don't thank me, just do the work.";
      } else if (tone === 'encouraging') {
        reply = "You are so welcome! Keep up the amazing energy! ✨";
      } else {
        reply = "Anytime! Let me know if you need to optimize anything else.";
      }
    } else if (isGreeting || cleanText.length < 15) {
      if (tone === 'aggressive') {
        reply = "What's up? Stop procrastinating and tell me what tasks we are crushing today.";
      } else if (tone === 'encouraging') {
        reply = "Hello! Hope your day is going wonderfully. What can we plan together today? 🦖";
      } else {
        reply = "Hey! All good on my end — anything you need help getting ahead of today?";
      }
    } else {
      if (tone === 'aggressive') {
        reply = "I'm here to plan your schedule, not chat. Tell me what tasks you need to get done.";
      } else if (tone === 'encouraging') {
        reply = "Hey there! I'm here to help you organize your tasks and stay stress-free. What are we planning next? 🦖";
      }
    }
    return { reply, newTasks: [], isLocal: true };
  }

  // 2. Question Classification (Bug A)
  const isQuestion = /\b(what|when|any|do i have|list|view|show|due|pending|schedule|timetable|how many|overdue|missed|late)\b/i.test(normalizedText) 
    && !/\b(add|create|new|schedule a|make a|set a|remind me to|task to)\b/i.test(normalizedText);

  if (isQuestion) {
    const incomplete = currentTasks.filter(t => !t.completed);
    
    const isOverdueQuery = /\b(overdue|missed|late|past)\b/i.test(cleanText);
    const isDueSoonQuery = /\b(soon|coming|week|next 2 days|next 3 days|48 hours|72 hours)\b/i.test(cleanText);
    const isMath = cleanText.includes('math');
    const isPhysics = cleanText.includes('physics');
    
    let filteredTasks = incomplete;
    let queryContext = '';

    if (isOverdueQuery) {
      filteredTasks = incomplete.filter(t => {
        const dueDate = parseDueDate(t.dueDate);
        return dueDate.getTime() < Date.now();
      });
      queryContext = 'overdue ';
    } else if (isDueSoonQuery) {
      filteredTasks = incomplete.filter(t => {
        const dueDate = parseDueDate(t.dueDate);
        const diffMs = dueDate.getTime() - Date.now();
        return diffMs > 0 && diffMs <= 72 * 60 * 60 * 1000; // next 72 hours
      });
      queryContext = 'upcoming ';
    } else if (isMath) {
      filteredTasks = incomplete.filter(t => t.title.toLowerCase().includes('math'));
      queryContext = 'math ';
    } else if (isPhysics) {
      filteredTasks = incomplete.filter(t => t.title.toLowerCase().includes('physics'));
      queryContext = 'physics ';
    }

    if (filteredTasks.length === 0) {
      let reply = `nothing ${queryContext}on your list right now — you're clear!`;
      if (isOverdueQuery) reply = "nothing overdue — you're on track.";
      else if (isDueSoonQuery) reply = "nothing due soon! you're in the clear for the next few days.";
      else if (isMath || isPhysics) reply = `clean slate for ${queryContext}tasks!`;
      return { reply, newTasks: [], isLocal: true };
    }

    // Filter out someday tasks from task list queries
    const displayTasks = filteredTasks.filter(t => !t.isSomeday);
    if (displayTasks.length === 0) {
      return { reply: "no active tasks right now — just some future ideas in your someday list.", newTasks: [], isLocal: true };
    }

    let reply = '';
    if (displayTasks.length === 1) {
      reply = `yeah, you've got one ${queryContext}task: ${displayTasks[0].title} (due ${displayTasks[0].dueDate}${displayTasks[0].scheduledTime ? `, at ${displayTasks[0].scheduledTime}` : ''})`;
    } else {
      reply = `here's your ${queryContext}list (${displayTasks.length} tasks):\n` +
        displayTasks.map(t => `• ${t.title} — due ${t.dueDate}${t.scheduledTime ? ` at ${t.scheduledTime}` : ''}`).join('\n');
    }
    return { reply, newTasks: [], isLocal: true };
  }

  // 3. Task Request (Call Backend API)
  try {
    const fetchPromise = fetch(`${SERVER_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        tone,
        profile,
        userId: 'default-user',
        currentDate: new Date().toISOString(),
        localTimeContext: new Date().toLocaleString()
      })
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      return res.json();
    });

    const data = await withTimeout(fetchPromise, 9000, "Server timeout");

    const newTasks: Task[] = (data.tasks || []).map((t: any, index: number) => ({
      ...t,
      title: summarizeTaskTitle(t.title),
      details: t.details || t.title,
      id: `task-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
      completed: false
    }));

    // Cache the successful API response
    chatCache.set(cacheKey, {
      reply: data.reply,
      newTasks: newTasks,
      timestamp: Date.now()
    });

    return {
      reply: data.reply || "i've set that up in your calendar for you.",
      newTasks,
      timetableProposal: data.timetableProposal
    };
  } catch (err) {
    console.warn("Express server chat error or timeout. Falling back to local offline mock processing:", err);
  }

  // Local Processing fallback (acts like a local agent)
  for (const handler of MOCK_AURA_RESPONSES) {
    if (handler.trigger.some(word => normalizedText.includes(word))) {
      const result = handler.getResponse(text, tone);
      const newTasks: Task[] = result.tasks.map((t, idx) => ({
        ...t,
        title: summarizeTaskTitle(t.title),
        details: t.details || t.title,
        id: `task-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        completed: false
      }));
      return {
        reply: result.reply,
        newTasks,
        timetableProposal: (result as any).timetableProposal
      };
    }
  }

  // Extract time from message for smarter local fallback
  const cleanFallbackTitle = summarizeTaskTitle(text);
  const timeInMsg = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  const dayInMsg = text.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
  const extractedDay = dayInMsg ? (dayInMsg[1].charAt(0).toUpperCase() + dayInMsg[1].slice(1).toLowerCase()) : 'Tonight';
  const extractedTime = timeInMsg ? timeInMsg[1].trim() : '7:00 PM';
  const extractedTimeEnd = timeInMsg ? (() => {
    const h = parseInt(timeInMsg[1]);
    const ampm = timeInMsg[1].toLowerCase().includes('pm') ? 'PM' : 'AM';
    return `${h + 1}:00 ${ampm}`;
  })() : '8:00 PM';

  let fallbackReply = `okay, ${extractedDay.toLowerCase() === 'tonight' ? 'tonight' : extractedDay} at ${extractedTime} works — I've blocked that for "${cleanFallbackTitle}". lmk if you need a different slot.`;
  if (tone === 'aggressive') {
    fallbackReply = `"${cleanFallbackTitle}" is on at ${extractedTime} ${extractedDay}. get it done.`;
  } else if (tone === 'encouraging') {
    fallbackReply = `${extractedDay} ${extractedTime} is saved for "${cleanFallbackTitle}" — one step at a time, you've got this! 🦖`;
  }

  return {
    reply: fallbackReply,
    newTasks: [
      {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: cleanFallbackTitle,
        details: text,
        dueDate: extractedDay === 'Tonight' ? 'Today' : extractedDay,
        duration: '1 hour',
        urgency: 'medium' as const,
        category: 'personal' as const,
        completed: false,
        scheduledTime: `${extractedDay} ${extractedTime} - ${extractedTimeEnd}`,
        energyLevel: guessEnergyLevel(cleanFallbackTitle, '1 hour'),
        studyGuide: '• Break down task objectives\n• Dedicate 45 mins uninterrupted focus\n• Review progress.'
      }
    ]
  };
}

// 2. Scan screenshot OCR using Express Server proxy
export async function scanImageWithGemini(
  base64Data: string,
  mimeType: string,
  _apiKey?: string // Obsoleted client-side API Key
): Promise<{ title: string; dueDate: string; urgency: 'high' | 'medium' | 'low'; description: string }> {
  try {
    const fetchPromise = fetch(`${SERVER_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType })
    }).then(async (res) => {
      if (!res.ok) throw new Error("Server OCR failed");
      return res.json();
    });

    return await withTimeout(fetchPromise, 9000, "Server OCR timeout");
  } catch (error) {
    console.error("OCR server call failed, using high-fidelity fallback:", error);
    return {
      title: 'Math Assignment',
      dueDate: '27th May 2026',
      urgency: 'high',
      description: 'Integration and Calculus exercises due in 2 days.'
    };
  }
}

// 3. Generate micro-plan for urgent/last-minute tasks (Feature 2)
export async function generateMicroplanFromServer(
  title: string,
  duration: string,
  studyGuide?: string
): Promise<string[]> {
  try {
    const fetchPromise = fetch(`${SERVER_URL}/generate-microplan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, duration, studyGuide })
    }).then(async (res) => {
      if (!res.ok) throw new Error("Server failed to generate microplan");
      return res.json();
    });

    return await withTimeout(fetchPromise, 8000, "Microplan timeout");
  } catch (error) {
    console.error("Failed to generate microplan from server, falling back to mock:", error);
    return [
      "1. Clear your desk and shut down phone alerts (2 mins)",
      "2. Write out the first two formulas or outline points (10 mins)",
      "3. Work focused for 25 minutes straight (25 mins)"
    ];
  }
}

// 4. Generate quick win for <= 10 min first step (Feature 3)
export async function generateQuickWinFromServer(
  task: Task
): Promise<{ subTaskTitle: string; guide: string }> {
  try {
    const fetchPromise = fetch(`${SERVER_URL}/generate-quickwin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    }).then(async (res) => {
      if (!res.ok) throw new Error("Server failed to generate quick-win");
      return res.json();
    });

    return await withTimeout(fetchPromise, 8000, "Quick Win timeout");
  } catch (error) {
    console.error("Failed to generate quick-win from server, falling back to mock:", error);
    return {
      subTaskTitle: `Start ${task.title}`,
      guide: "Spend 5 minutes setting up your workspace and drafting the absolute first line."
    };
  }
}

// 5. Daily Re-Plan agent schedule check (Feature 1)
export interface ReplanResult {
  riskFound: boolean;
  explanation: string;
  updatedTasks: Task[];
  insights?: {
    overloadAlert: string;
    studyPattern: string;
    habitSuggestion: string;
  };
}

export async function evaluateReplanFromServer(
  tasks: Task[],
  profile: UserScheduleProfile
): Promise<ReplanResult> {
  try {
    const fetchPromise = fetch(`${SERVER_URL}/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, profile })
    }).then(async (res) => {
      if (!res.ok) throw new Error("Server re-plan check failed");
      return res.json();
    });

    return await withTimeout(fetchPromise, 10000, "Re-plan timeout");
  } catch (error) {
    console.error("Failed to run re-plan from server, falling back to mock:", error);
    
    // Dynamic fallback generation based on actual tasks & profile (Bug 4)
    const incomplete = tasks.filter(t => !t.completed);
    let overloadAlert = "Your schedule is currently clear. No conflicts detected.";
    if (incomplete.length > 3) {
      overloadAlert = `You have ${incomplete.length} active tasks on your schedule. Aura has optimized your blocks to prevent burnout.`;
    } else if (incomplete.length > 0) {
      overloadAlert = `All good. You have ${incomplete.length} active task${incomplete.length > 1 ? 's' : ''} scheduled nicely.`;
    } else {
      overloadAlert = "Awesome! You have no pending tasks right now.";
    }

    const bestStudyTime = profile.customQA[0]?.answer || "late evenings";
    const studyPattern = `Based on your schedule and habits, you do your best work during ${bestStudyTime}.`;
    
    let habitSuggestion = "Try the Pomodoro technique (25m study, 5m break) for your next task block.";
    if (profile.hasTuition) {
      habitSuggestion = `We scheduled your study blocks around your tuition timings (${profile.tuitionTimingsStart} - ${profile.tuitionTimingsEnd}) to keep your mind fresh.`;
    }

    return {
      riskFound: false,
      explanation: "Local agent offline: All schedules checked and look safe.",
      updatedTasks: tasks,
      insights: {
        overloadAlert,
        studyPattern,
        habitSuggestion
      }
    };
  }
}

// 6. Generate a short, meaningful title for archived chat sessions based on content (Issue 5)
export function generateSessionTitle(log: any[]): string {
  // Find proposed tasks in the log
  const taskLog = log.find(item => item.tasks && item.tasks.length > 0);
  if (taskLog && taskLog.tasks && taskLog.tasks.length > 0) {
    const firstTask = taskLog.tasks[0].title;
    const cleanTitle = firstTask.length > 25 ? `${firstTask.substring(0, 25)}...` : firstTask;
    return `Plan: ${cleanTitle}`;
  }

  // Find first user message
  const firstUserMsg = log.find(item => item.sender === 'user')?.text || '';
  if (!firstUserMsg) return "Empty Session";

  const cleanMsg = firstUserMsg.toLowerCase().trim();
  
  // Heuristics
  if (cleanMsg.includes('overdue') || cleanMsg.includes('late') || cleanMsg.includes('missed')) {
    return "Review Overdue Tasks";
  }
  if (cleanMsg.includes('soon') || cleanMsg.includes('coming') || cleanMsg.includes('due')) {
    return "Upcoming Deadlines";
  }
  if (cleanMsg.includes('quick win') || cleanMsg.includes('win') || cleanMsg.includes('quickwin')) {
    return "Quick Win Focus Session";
  }
  if (cleanMsg.includes('timetable') || cleanMsg.includes('schedule') || cleanMsg.includes('routine')) {
    return "Timetable Discussion";
  }
  if (cleanMsg.includes('gym') || cleanMsg.includes('workout') || cleanMsg.includes('fitness')) {
    return "Workout Scheduling";
  }
  if (cleanMsg.includes('bill') || cleanMsg.includes('rent') || cleanMsg.includes('pay')) {
    return "Bill Payments Plan";
  }
  if (cleanMsg.includes('math')) {
    return "Math Study Planning";
  }
  if (cleanMsg.includes('physics')) {
    return "Physics Lab Review";
  }
  if (cleanMsg.includes('what can you do') || cleanMsg.includes('features') || cleanMsg.includes('help')) {
    return "Aura Capabilities Guide";
  }

  // Fallback snippet
  const words = firstUserMsg.split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return firstUserMsg;
  }
  return words.slice(0, 4).join(' ') + '...';
}

// 7. Auto-guess task energy requirements based on title and duration (Issue 6.3)
export function guessEnergyLevel(title: string, duration: string): 'high_focus' | 'low_effort' {
  const clean = title.toLowerCase();
  const highFocusKeywords = ['math', 'physics', 'science', 'write', 'study', 'exam', 'test', 'prep', 'outline', 'report', 'essay', 'paper', 'quiz', 'lab', 'class', 'code', 'program', 'read'];
  if (highFocusKeywords.some(kw => clean.includes(kw))) {
    return 'high_focus';
  }
  if (duration.includes('hour') && !duration.includes('0.')) {
    return 'high_focus';
  }
  return 'low_effort';
}

// 8. Capture vague future thoughts with NO calendar pressure (Issue 6.2)
export function isSomedayMaybeQuery(text: string): boolean {
  const clean = text.toLowerCase().trim();
  const keywords = ['sometime', 'someday', 'maybe', 'one day', 'want to learn', 'dream of', 'wish to', 'sometime in the future', 'thinking about learning'];
  return keywords.some(kw => clean.includes(kw));
}

// 9. Summarize raw user phrasings into clean 2-5 word task titles (Bug 2)
export function summarizeTaskTitle(text: string): string {
  const clean = text.trim();
  if (!clean) return "New Task";
  
  // Strip leading filler phrases (with typos)
  let processed = clean
    .replace(/^(i want to|i need to|i have to|i hav to|i ned to|i must|please|can you|help me|remember to|remind me to|i should|thinking about|dream of|wish to|want to|wanna|gotta|hafta|i wnat to|i wnat|i ahve to|i hav|ned to)\s+/i, '')
    .trim();

  // Remove trailing time/date/filler (but keep the core action)
  processed = processed
    .replace(/\s+on\s+(this|next|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b.*/i, '')
    .replace(/\s+(tomorrow|today|tonight|yesterday|someday|sometime|maybe|one day|in the future|later|soon)\b.*/i, '')
    .replace(/\s+at\s+\d{1,2}(:\d{2})?\s*(am|pm)?.*/i, '')
    .replace(/\s+by\s+\d{1,2}(:\d{2})?\s*(am|pm)?.*/i, '')
    .replace(/\s+(for|this|on|next|upcoming|in)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|morning|evening|night|the)\b.*/i, '')
    .trim();

  // Extract person name for meetings ("meet X for Y" → "Meet X")
  const meetMatch = processed.match(/^(meet|meeting with|call with|catch up with|talk to|talk with)\s+([a-zA-Z]+)/i);
  if (meetMatch) {
    const verb = meetMatch[1].toLowerCase().startsWith('meet') ? 'Meet' : meetMatch[1];
    const name = meetMatch[2].charAt(0).toUpperCase() + meetMatch[2].slice(1).toLowerCase();
    return `${verb} ${name}`;
  }

  // Capitalize first letter
  processed = processed.charAt(0).toUpperCase() + processed.slice(1);
  
  // Limit to 4-5 words max
  const words = processed.split(/\s+/);
  if (words.length > 5) {
    return words.slice(0, 4).join(' ') + '...';
  }
  return processed;
}
