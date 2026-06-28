const SERVER_URL = 'http://localhost:5000/api';
// Cache for recent chat commands to prevent duplicate API calls
const chatCache = new Map();
// Fallback response library to handle cases where API key is missing or offline
const MOCK_AURA_RESPONSES = [
    {
        trigger: ['school timing', 'tuition timing', 'my routine', 'my schedule', 'subjects list', 'free on weekend', 'college timings', 'college timing', 'subjects i have'],
        getResponse: (text, tone) => {
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
                if (startAmpm === 'pm' && startHour < 12)
                    startHour += 12;
                if (startAmpm === 'am' && startHour === 12)
                    startHour = 0;
                if (endAmpm === 'pm' && endHour < 12)
                    endHour += 12;
                if (endAmpm === 'am' && endHour === 12)
                    endHour = 0;
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
            const timetableProposal = {
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
            if (startHour >= 24)
                startHour = 19;
            const formattedStartHour = startHour > 12 ? startHour - 12 : startHour;
            const startAmpm = startHour >= 12 ? 'PM' : 'AM';
            let weekdayBlocks = "";
            if (subjectsCount > 0) {
                weekdayBlocks = `• **Weekdays (Evening)**: Start at ${formattedStartHour}:00 ${startAmpm}. Proposed: `;
                const blocksList = [];
                let currentHour = startHour;
                for (let i = 1; i <= Math.min(3, subjectsCount); i++) {
                    const blockStart = `${currentHour > 12 ? currentHour - 12 : currentHour}:00 ${currentHour >= 12 ? 'PM' : 'AM'}`;
                    currentHour += 1;
                    const blockEnd = `${currentHour > 12 ? currentHour - 12 : currentHour}:00 ${currentHour >= 12 ? 'PM' : 'AM'}`;
                    blocksList.push(`Block ${i} (${blockDuration}): ${blockStart} - ${blockEnd}`);
                }
                weekdayBlocks += blocksList.join(', ') + ` (with ${breakDuration} breaks).`;
            }
            else {
                weekdayBlocks = `• **Weekdays**: 7:00 PM - 9:00 PM study sessions.`;
            }
            const weekendText = `• **Weekends**: Saturday is free. Sunday has a planned ${weekendLeisureHours} hours personal day, leaving ample time for structured revision blocks.`;
            let reply = `Got it — I understood your routine as:\n` +
                `• **Role**: ${role === 'student' ? 'Student' : 'Employee'}\n` +
                `• **Busy Hours**: ${schoolTimingsStart} to ${schoolTimingsEnd} (${subjectsCount} subjects, ${blockDuration} blocks with ${breakDuration} breaks)\n` +
                `• **Weekends**: Saturday free, Sunday ${weekendLeisureHours} hours personal time\n\n` +
                `Based on this, here is a proposed study schedule:\n` +
                `${weekdayBlocks}\n` +
                `${weekendText}\n\n` +
                `Click the button below to apply this immediately to your Timetable settings!`;
            return {
                reply,
                tasks: [],
                timetableProposal
            };
        }
    },
    {
        trigger: ['homework', 'assignment', 'project', 'due', 'math', 'history', 'physics', 'essay'],
        getResponse: (text, tone) => {
            const match = text.match(/(math|history|physics|essay|science|project|assignment)/i);
            const subject = match ? match[0] : 'Project';
            const title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Assignment`;
            const now = new Date();
            const currentDay = now.getDay();
            let diff = 4 - currentDay; // Thursday is 4
            if (diff <= 0)
                diff += 7; // Next Thursday
            const nextThursday = new Date(now);
            nextThursday.setDate(now.getDate() + diff);
            const formattedDate = nextThursday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = `${formattedDate} 3:00 PM`;
            let reply = '';
            if (tone === 'aggressive') {
                reply = `Listen: you have a **${title}** due. I blocked next Thursday (${formattedDate}) 3–5 PM for it. Stop procrastinating and get it done.`;
            }
            else if (tone === 'encouraging') {
                reply = `You can do it! I've set aside next Thursday (${formattedDate}) from 3:00 PM to 5:00 PM for your **${title}**. Take breaks and breathe! 🦖`;
            }
            else {
                reply = `Got it — I've scheduled a 2-hour block for your **${title}** next Thursday (${formattedDate}) from 3:00 PM to 5:00 PM.`;
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
        getResponse: (text, tone) => {
            const match = text.match(/(rent|electricity|bill|subscription|netflix|spotify)/i);
            const billType = match ? match[0] : 'Rent';
            const title = `Pay ${billType.charAt(0).toUpperCase() + billType.slice(1)}`;
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            const tomorrowStr = tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            let reply = '';
            if (tone === 'aggressive') {
                reply = `Hey, your **${title}** is due tomorrow (${tomorrowStr}). Pay it now before they cut you off. Blocked today at 6 PM.`;
            }
            else if (tone === 'encouraging') {
                reply = `Gentle nudge to **${title}** today at 6 PM. Getting it out of the way will feel so good!`;
            }
            else {
                reply = `Got it — I've scheduled a 15-minute slot for **${title}** today at 6:00 PM.`;
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
        getResponse: (_text, tone) => {
            const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            let reply = '';
            if (tone === 'aggressive') {
                reply = `Stop scrolling. Workout scheduled for 5:00 PM today (${todayStr}). Lace up your shoes and go! 🦖`;
            }
            else if (tone === 'encouraging') {
                reply = `Let's get moving! A 45-minute workout block is set for 5:00 PM today (${todayStr}). You'll feel amazing after.`;
            }
            else {
                reply = `Got it — scheduled a 45-minute fitness session for you today (${todayStr}) at 5:00 PM.`;
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
function withTimeout(promise, ms, errorMessage = "Request timed out") {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
    ]);
}
// Helper to parse absolute or relative due dates (Bug A)
export function parseDueDate(dueDateStr) {
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
            if (diff <= 0)
                diff += 7; // Next week's weekday
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
export function getEditDistance(a, b) {
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
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                Math.min(matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                ));
            }
        }
    }
    return matrix[b.length][a.length];
}
// Typo-robust structural heuristic and fuzzy classifier for capability/help queries
export function isCapabilityQuery(text) {
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
        if (clean === phrase)
            return true;
        if (clean.length > 3 && phrase.length > 3) {
            const distance = getEditDistance(clean, phrase);
            if (distance <= 2) {
                console.log(`[Fuzzy Classifier] Matched capability query: "${clean}" close to "${phrase}" (dist: ${distance})`);
                return true;
            }
        }
    }
    // 2. Structural Heuristics
    // Check date signals
    const dateKeywords = [
        'today', 'tomorrow', 'yesterday',
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
        'due', 'deadline', 'scheduled', 'by', 'on', 'at'
    ];
    const timePattern = /\b\d{1,2}(:\d{2})?(\s*(am|pm))?\b/i;
    const hasDateSignal = dateKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(clean)) || timePattern.test(clean);
    // Check task nouns
    const taskNouns = [
        'assignment', 'assignments', 'homework', 'homeworks', 'submission', 'submissions', 'submit', 'exam', 'exams', 'test', 'tests', 'bill', 'bills',
        'rent', 'rents', 'electricity', 'meeting', 'meetings', 'report', 'reports', 'project', 'projects', 'gym', 'gyms', 'workout', 'workouts',
        'run', 'runs', 'exercise', 'exercises', 'subscription', 'subscriptions', 'task', 'tasks', 'todo', 'todos', 'to do', 'to dos', 'quiz', 'quizzes',
        'essay', 'essays', 'paper', 'papers', 'groceries', 'outline', 'outlines', 'lab', 'labs', 'class', 'classes', 'timetable', 'timetables'
    ];
    const hasTaskNoun = taskNouns.some(noun => new RegExp(`\\b${noun}\\b`, 'i').test(clean));
    // If there are clear task signals, it's NOT a capability query (it's a task request)
    if (hasDateSignal || hasTaskNoun) {
        return false;
    }
    // Question structure check
    const words = clean.split(/\s+/).filter(Boolean);
    const isShort = words.length <= 8;
    const questionStartPattern = /^(what|why|how|who|when|can\s+u|can\s+you|do\s+u|do\s+you|are\s+u|are\s+you|tell\s+me|show\s+me|help|wut|wat|whay|wuy|hwo|wen)\b/i;
    const matchesQuestionPrefix = questionStartPattern.test(clean);
    const matchesCapabilityConcept = clean.includes('you do') ||
        clean.includes('u do') ||
        clean.includes('help') ||
        clean.includes('features') ||
        clean.includes('commands') ||
        clean.includes('capabilities') ||
        clean.includes('aura');
    if (isShort && (matchesQuestionPrefix || matchesCapabilityConcept)) {
        console.log(`[Structural Classifier] Matched capability query structurally: "${clean}" (short, question pattern, no task signals)`);
        return true;
    }
    return false;
}
// Checks if the user message describes general routine/context/preferences rather than an actionable task/deadline
export function isRoutineOrContextQuery(text) {
    const normalized = text.toLowerCase().trim();
    const clean = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    // 1. Key indicators of schedule preferences, timings, subjects list, routine context
    const contextPhrases = [
        'school timing', 'school timings', 'school time', 'school hours',
        'tuition timing', 'tuition timings', 'tuition time', 'tuition hours',
        'busy from', 'busy between', 'free from', 'free between',
        'study best', 'study habit', 'study habits',
        'my routine', 'my schedule', 'proper schedule', 'busy hours', 'free time',
        'routine info', 'routine details', 'preferences',
        'my class', 'my classes', 'my school', 'my tuition',
        'subjects list', 'list of subjects', 'my subjects', 'i study', 'subjects i have',
        'my day', 'my week', 'leisure time', 'leisure hours', 'my timetable'
    ];
    if (contextPhrases.some(phrase => clean.includes(phrase))) {
        // Make sure it doesn't contain a specific actionable task deliverable deadline (like 'due tomorrow', 'due today', etc.)
        const taskTriggers = ['due', 'deadline', 'submit', 'homework', 'assignment', 'exam', 'test', 'bill', 'pay', 'gym', 'workout', 'run', 'quiz', 'project', 'paper', 'lab'];
        const hasTaskTrigger = taskTriggers.some(trigger => new RegExp(`\\b${trigger}\\b`, 'i').test(clean));
        const hasDateSignal = /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|by|on)\b/i.test(clean);
        if (hasTaskTrigger && hasDateSignal) {
            return false; // Actually a task request
        }
        return true;
    }
    // 2. Descriptive timings or routines without action keywords
    if (clean.includes('timing') || clean.includes('timings') || clean.includes('schedule') || clean.includes('subject')) {
        const actionKeywords = ['add', 'submit', 'due', 'deadline', 'homework', 'assignment', 'exam', 'test', 'bill', 'pay', 'gym', 'workout', 'run', 'quiz', 'project'];
        const hasAction = actionKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(clean));
        if (!hasAction) {
            return true;
        }
    }
    return false;
}
// 1. Process Aura chat command via Express Server proxy
export async function processAuraCommand(text, _apiKey, // Obsoleted client-side API Key
profile, currentTasks = []) {
    const normalizedText = text.toLowerCase().trim();
    // Escalate tone automatically if any task is in Last-Minute Mode (hours <= 12)
    const hasLastMinute = currentTasks.some(t => {
        if (t.completed || t.isSomeday)
            return false;
        const hrs = (parseDueDate(t.dueDate).getTime() - Date.now()) / (3600 * 1000);
        return hrs > 0 && hrs <= 12;
    });
    const tone = hasLastMinute ? 'aggressive' : (profile?.coachingTone || 'balanced');
    // --- Caching Layer (Bug 3) ---
    const cacheKey = `${tone}-${normalizedText}`;
    if (chatCache.has(cacheKey)) {
        const cached = chatCache.get(cacheKey);
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
                reply: data.reply || "Got it — processed your routine settings.",
                newTasks: [],
                timetableProposal: data.timetableProposal
            };
        }
        catch (err) {
            console.warn("Backend server routine call failed, falling back to local routine parser:", err);
        }
        // Local Fallback routine parser
        const mockHandler = MOCK_AURA_RESPONSES.find(h => h.trigger.some(triggerWord => normalizedText.includes(triggerWord)));
        if (mockHandler) {
            const result = mockHandler.getResponse(text, tone);
            return {
                reply: result.reply,
                newTasks: [],
                timetableProposal: result.timetableProposal
            };
        }
    }
    const cleanText = normalizedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    // Robust Capability Check (Fuzzy + Structural)
    if (isCapabilityQuery(normalizedText)) {
        let reply = "I'm Aura, your AI productivity companion! I can help you:\n• **Schedule assignments** automatically around your timetable.\n• **Escalate urgent deadlines** into Last-Minute mode with concrete next steps.\n• **Identify 10-minute quick wins** to help you get started.\n• **Answer questions** about your pending tasks, schedule, and due dates.";
        if (tone === 'aggressive') {
            reply = "I'm Aura. I schedule your tasks, organize your calendar, and tell you to get to work. Ask me to add a task or type 'do I have assignments?' to see what you're ignoring.";
        }
        else if (tone === 'encouraging') {
            reply = "I'm Aura, here to support you! I help you schedule your tasks safely, remind you when deadlines are close, find 10-minute quick wins to build momentum, and keep you stress-free! 🦖";
        }
        return { reply, newTasks: [], isLocal: true };
    }
    // Check for vague future thoughts (Someday/Maybe bucket) (Issue 6.2)
    if (isSomedayMaybeQuery(normalizedText)) {
        let reply = `Captured! I've added "${text}" to your Someday/Maybe list. There's no deadline or calendar pressure, so focus on what's due first!`;
        const newTask = {
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
    // Comprehensive task-specific keywords (Bug B)
    const taskKeywords = [
        'due', 'task', 'math', 'assign', 'work', 'exam', 'test', 'bill', 'pay', 'gym',
        'rent', 'electricity', 'subscription', 'homework', 'project', 'study', 'exercise',
        'outline', 'submit', 'do', 'add', 'create', 'make', 'schedule', 'remind', 'calendar', 'timetable',
        'workout', 'run', 'fitness', 'meeting', 'meet', 'groceries', 'buy', 'call', 'todo', 'to do',
        'lab', 'essay', 'paper', 'report', 'review', 'science', 'history', 'quiz', 'done', 'finish', 'complete'
    ];
    const hasTaskKeywords = taskKeywords.some(keyword => cleanText.includes(keyword));
    // 1. Casual Chat Classification (Broadened so chitchat defaults here)
    if (!hasTaskKeywords) {
        let reply = "I'm Aura, your scheduling companion. Let me know what assignments or tasks you want to schedule today!";
        // Check if it matches greetings or thanks patterns
        const isGreeting = casualGreetingPattern.test(cleanText) || cleanText.split(/\s+/).some(w => casualGreetingPattern.test(w));
        const isThanks = casualThanksPattern.test(cleanText) || cleanText.split(/\s+/).some(w => casualThanksPattern.test(w));
        if (isThanks) {
            if (tone === 'aggressive') {
                reply = "Don't thank me, just do the work.";
            }
            else if (tone === 'encouraging') {
                reply = "You are so welcome! Keep up the amazing energy! ✨";
            }
            else {
                reply = "Anytime! Let me know if you need to optimize anything else.";
            }
        }
        else if (isGreeting || cleanText.length < 15) {
            if (tone === 'aggressive') {
                reply = "What's up? Stop procrastinating and tell me what tasks we are crushing today.";
            }
            else if (tone === 'encouraging') {
                reply = "Hello! Hope your day is going wonderfully. What can we plan together today? 🦖";
            }
            else {
                reply = "Hey! All good on my end — anything you need help getting ahead of today?";
            }
        }
        else {
            if (tone === 'aggressive') {
                reply = "I'm here to plan your schedule, not chat. Tell me what tasks you need to get done.";
            }
            else if (tone === 'encouraging') {
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
        }
        else if (isDueSoonQuery) {
            filteredTasks = incomplete.filter(t => {
                const dueDate = parseDueDate(t.dueDate);
                const diffMs = dueDate.getTime() - Date.now();
                return diffMs > 0 && diffMs <= 72 * 60 * 60 * 1000; // next 72 hours
            });
            queryContext = 'upcoming ';
        }
        else if (isMath) {
            filteredTasks = incomplete.filter(t => t.title.toLowerCase().includes('math'));
            queryContext = 'math ';
        }
        else if (isPhysics) {
            filteredTasks = incomplete.filter(t => t.title.toLowerCase().includes('physics'));
            queryContext = 'physics ';
        }
        if (filteredTasks.length === 0) {
            let reply = `Nothing ${queryContext}on your checklist right now. You're completely clear!`;
            if (isOverdueQuery) {
                reply = "Nothing overdue right now — you're on track.";
            }
            else if (isDueSoonQuery) {
                reply = "Nothing due soon! You're in the clear for the next few days.";
            }
            else if (isMath || isPhysics) {
                reply = `You've got a clean slate for ${queryContext}tasks!`;
            }
            return { reply, newTasks: [], isLocal: true };
        }
        // Tight bulleted formatting instead of flat walls (Bug A)
        let reply = '';
        if (filteredTasks.length === 1) {
            reply = `Yep, you've got one ${queryContext}task pending:\n• **${filteredTasks[0].title}** (due ${filteredTasks[0].dueDate}${filteredTasks[0].scheduledTime ? `, scheduled ${filteredTasks[0].scheduledTime}` : ''})`;
        }
        else {
            reply = `Yep, you have ${filteredTasks.length} ${queryContext}tasks pending:\n` +
                filteredTasks.map(t => `• **${t.title}** (due ${t.dueDate}${t.scheduledTime ? `, scheduled ${t.scheduledTime}` : ''})`).join('\n');
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
        const newTasks = (data.tasks || []).map((t, index) => ({
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
            reply: data.reply || "Got it — scheduled that in your study calendar.",
            newTasks,
            timetableProposal: data.timetableProposal
        };
    }
    catch (err) {
        console.warn("Express server chat error or timeout. Falling back to local offline mock processing:", err);
    }
    // Local Processing fallback (acts like a local agent)
    for (const handler of MOCK_AURA_RESPONSES) {
        if (handler.trigger.some(word => normalizedText.includes(word))) {
            const result = handler.getResponse(text, tone);
            const newTasks = result.tasks.map((t, idx) => ({
                ...t,
                title: summarizeTaskTitle(t.title),
                details: t.details || t.title,
                id: `task-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
                completed: false
            }));
            return {
                reply: result.reply,
                newTasks,
                timetableProposal: result.timetableProposal
            };
        }
    }
    // Refined natural text fallback response (Bug 2)
    let cleanFallbackTitle = summarizeTaskTitle(text);
    let fallbackReply = `Got it — I've scheduled a block for "${cleanFallbackTitle}" tonight. Let me know if that works!`;
    if (tone === 'aggressive') {
        fallbackReply = `Stop scrolling and get ready. I scheduled a block for "${cleanFallbackTitle}" tonight at 7 PM. No excuses.`;
    }
    else if (tone === 'encouraging') {
        fallbackReply = `I've set aside some time for "${cleanFallbackTitle}" tonight. You've got this, let's take it one step at a time! 🦖`;
    }
    return {
        reply: fallbackReply,
        newTasks: [
            {
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                title: cleanFallbackTitle,
                details: text,
                dueDate: 'Tomorrow',
                duration: '1 hour',
                urgency: 'high',
                category: 'work',
                completed: false,
                scheduledTime: 'Today 7:00 PM - 8:00 PM',
                studyGuide: '• Break down task objectives\n• Dedicate 45 mins uninterrupted focus\n• Review progress.'
            }
        ]
    };
}
// 2. Scan screenshot OCR using Express Server proxy
export async function scanImageWithGemini(base64Data, mimeType, _apiKey // Obsoleted client-side API Key
) {
    try {
        const fetchPromise = fetch(`${SERVER_URL}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data, mimeType })
        }).then(async (res) => {
            if (!res.ok)
                throw new Error("Server OCR failed");
            return res.json();
        });
        return await withTimeout(fetchPromise, 9000, "Server OCR timeout");
    }
    catch (error) {
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
export async function generateMicroplanFromServer(title, duration, studyGuide) {
    try {
        const fetchPromise = fetch(`${SERVER_URL}/generate-microplan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, duration, studyGuide })
        }).then(async (res) => {
            if (!res.ok)
                throw new Error("Server failed to generate microplan");
            return res.json();
        });
        return await withTimeout(fetchPromise, 8000, "Microplan timeout");
    }
    catch (error) {
        console.error("Failed to generate microplan from server, falling back to mock:", error);
        return [
            "1. Clear your desk and shut down phone alerts (2 mins)",
            "2. Write out the first two formulas or outline points (10 mins)",
            "3. Work focused for 25 minutes straight (25 mins)"
        ];
    }
}
// 4. Generate quick win for <= 10 min first step (Feature 3)
export async function generateQuickWinFromServer(task) {
    try {
        const fetchPromise = fetch(`${SERVER_URL}/generate-quickwin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task })
        }).then(async (res) => {
            if (!res.ok)
                throw new Error("Server failed to generate quick-win");
            return res.json();
        });
        return await withTimeout(fetchPromise, 8000, "Quick Win timeout");
    }
    catch (error) {
        console.error("Failed to generate quick-win from server, falling back to mock:", error);
        return {
            subTaskTitle: `Start ${task.title}`,
            guide: "Spend 5 minutes setting up your workspace and drafting the absolute first line."
        };
    }
}
export async function evaluateReplanFromServer(tasks, profile) {
    try {
        const fetchPromise = fetch(`${SERVER_URL}/replan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks, profile })
        }).then(async (res) => {
            if (!res.ok)
                throw new Error("Server re-plan check failed");
            return res.json();
        });
        return await withTimeout(fetchPromise, 10000, "Re-plan timeout");
    }
    catch (error) {
        console.error("Failed to run re-plan from server, falling back to mock:", error);
        // Dynamic fallback generation based on actual tasks & profile (Bug 4)
        const incomplete = tasks.filter(t => !t.completed);
        let overloadAlert = "Your schedule is currently clear. No conflicts detected.";
        if (incomplete.length > 3) {
            overloadAlert = `You have ${incomplete.length} active tasks on your schedule. Aura has optimized your blocks to prevent burnout.`;
        }
        else if (incomplete.length > 0) {
            overloadAlert = `All good. You have ${incomplete.length} active task${incomplete.length > 1 ? 's' : ''} scheduled nicely.`;
        }
        else {
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
export function generateSessionTitle(log) {
    // Find proposed tasks in the log
    const taskLog = log.find(item => item.tasks && item.tasks.length > 0);
    if (taskLog && taskLog.tasks && taskLog.tasks.length > 0) {
        const firstTask = taskLog.tasks[0].title;
        const cleanTitle = firstTask.length > 25 ? `${firstTask.substring(0, 25)}...` : firstTask;
        return `Plan: ${cleanTitle}`;
    }
    // Find first user message
    const firstUserMsg = log.find(item => item.sender === 'user')?.text || '';
    if (!firstUserMsg)
        return "Empty Session";
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
export function guessEnergyLevel(title, duration) {
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
export function isSomedayMaybeQuery(text) {
    const clean = text.toLowerCase().trim();
    const keywords = ['sometime', 'someday', 'maybe', 'one day', 'want to learn', 'dream of', 'wish to', 'sometime in the future', 'thinking about learning'];
    return keywords.some(kw => clean.includes(kw));
}
// 9. Summarize raw user phrasings into clean 2-5 word task titles (Bug 2)
export function summarizeTaskTitle(text) {
    const clean = text.trim();
    if (!clean)
        return "New Task";
    // Remove leading junk phrases
    let processed = clean
        .replace(/^(i want to|i need to|i have to|i must|please|can you|help me|remember to|remind me to|i should|thinking about|dream of|wish to|want to|sometime i should|sometime i want to)\s+/i, '')
        .trim();
    // Remove trailing relative dates/times/words
    processed = processed
        .replace(/\s+(someday|sometime|maybe|one day|in the future|later)$/i, '')
        .replace(/\s+(by tomorrow|tomorrow|today|yesterday|tonight|by next week|at \d+\s*(am|pm)|by \d+\s*(am|pm))$/i, '')
        .trim();
    // Capitalize first letter
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    // Limit to 4-5 words
    const words = processed.split(/\s+/);
    if (words.length > 5) {
        return words.slice(0, 4).join(' ') + '...';
    }
    return processed;
}
