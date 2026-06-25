import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Fallback response library to handle cases where API key is missing or offline
const MOCK_AURA_RESPONSES = [
  {
    trigger: ['homework', 'assignment', 'project', 'due', 'math', 'history', 'physics', 'essay'],
    getResponse: (text: string, tone: CoachingTone): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      const match = text.match(/(math|history|physics|essay|science|project|assignment)/i);
      const subject = match ? match[0] : 'Project';
      const title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Assignment`;
      
      let reply = '';
      if (tone === 'aggressive') {
        reply = `Listen up: I saw you have a **${title}** coming up. I scheduled a 2-hour deep-work block for it on Thursday from 3:00 PM to 5:00 PM. No procrastination. Get it done or I will spam you. Here's a strict study guide.`;
      } else if (tone === 'encouraging') {
        reply = `You've got this! I've scheduled a cozy 2-hour deep-work block for your **${title}** on Thursday from 3:00 PM to 5:00 PM. Take short breaks, drink some water, and remember I'm right here cheering you on! 🦖`;
      } else {
        reply = `I've analyzed your schedule and allocated a 2-hour deep-work block for your **${title}** on Thursday from 3:00 PM to 5:00 PM. Let's tackle this step-by-step.`;
      }

      return {
        reply,
        tasks: [
          {
            title: `${title} Prep & Outline`,
            dueDate: 'Thursday 3:00 PM',
            duration: '1 hour',
            urgency: 'high',
            category: 'study',
            scheduledTime: 'Thursday 3:00 PM - 4:00 PM',
            studyGuide: '• Review rubric\n• Gather reference materials\n• Draft introduction and structural points.'
          },
          {
            title: `Write & Finalize ${title}`,
            dueDate: 'Thursday 4:00 PM',
            duration: '1 hour',
            urgency: 'high',
            category: 'study',
            scheduledTime: 'Thursday 4:00 PM - 5:00 PM',
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
      const billType = match ? match[0] : 'Bill';
      const title = `Pay ${billType.charAt(0).toUpperCase() + billType.slice(1)}`;
      
      let reply = '';
      if (tone === 'aggressive') {
        reply = `Look at your wallet: **${title}** is due tomorrow. Pay it now before they cut you off or charge double! I put it in your schedule for today at 6 PM.`;
      } else if (tone === 'encouraging') {
        reply = `Just a gentle reminder to **${title}** today around 6 PM. Doing it now takes a huge weight off your shoulders! Let's get it paid!`;
      } else {
        reply = `I noted your **${title}** and added it to your timeline for today at 6:00 PM. Here is the outline to check off.`;
      }

      return {
        reply,
        tasks: [
          {
            title: title,
            dueDate: 'Tomorrow',
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
      let reply = '';
      if (tone === 'aggressive') {
        reply = `Stop scrolling and get moving! A 45-minute workout block is scheduled for 5:00 PM today. Put on your shoes and do it! No excuses! 🦖`;
      } else if (tone === 'encouraging') {
        reply = `Let's get some fresh air and positive energy! I've set a sweet 45-minute workout block for you at 5:00 PM today. You'll feel so refreshed afterwards!`;
      } else {
        reply = `I have scheduled a 45-minute fitness block for you today at 5:00 PM to help keep you active and focused.`;
      }
      return {
        reply,
        tasks: [
          {
            title: 'Fitness Session',
            dueDate: 'Today 5:00 PM',
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

export async function processAuraCommand(
  text: string,
  apiKey?: string,
  profile?: UserScheduleProfile | null
): Promise<{ reply: string; newTasks: Task[] }> {
  const normalizedText = text.toLowerCase();
  const tone = profile?.coachingTone || 'balanced';

  // If API Key is provided, use Google Generative AI
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const toneDirective = 
        tone === 'aggressive' 
          ? "COACHING TONE: Aggressive / Snarky. Be funny, slightly sarcastic, highly direct, and call out the user's potential for procrastination. Do not use generic corporate language."
          : tone === 'encouraging'
          ? "COACHING TONE: Encouraging / Warm. Be extremely positive, cozy, friendly, use phrases like 'you can do it!', and suggest self-care breaks."
          : "COACHING TONE: Balanced / Professional. Be helpful, clear, structured, and focused.";

      const scheduleConstraint = profile ? `
        The user has configured a custom available timetable:
        - Role: ${profile.role}
        - Busy hours (School/Work): ${profile.schoolTimingsStart} to ${profile.schoolTimingsEnd}
        - Tuition busy hours: ${profile.hasTuition ? `${profile.tuitionTimingsStart} to ${profile.tuitionTimingsEnd}` : 'None'}
        - Weekend Leisure hours limit: ${profile.weekendLeisureHours} hours
        - Custom habits Q&A: ${profile.customQA.map(qa => `Q: ${qa.question} | A: ${qa.answer}`).join(', ')}

        CRITICAL CALENDAR RULE: Do NOT schedule any tasks during the user's busy hours above. For example, if busy from 07:30 to 15:00, you cannot schedule a study task block at 10:00 AM. Choose an available slot later in the afternoon or evening (e.g. 4:00 PM or 7:00 PM). Ensure all task blocks fall strictly into their free times.
      ` : '';

      const prompt = `
        You are "Aura", an autonomous, proactive, extremely helpful AI productivity companion.
        The user has given you this request: "${text}"
        
        ${toneDirective}
        ${scheduleConstraint}

        Analyze the request and do the following:
        1. Formulate a friendly, conversational response matching the specified coaching tone.
        2. Extract any tasks that need to be created.
        3. For each task:
           - Provide a title.
           - Determine a realistic duration (e.g. "45 mins", "2 hours").
           - Assign urgency ('high' | 'medium' | 'low') based on priority.
           - Assign a category ('work' | 'personal' | 'study').
           - Schedule it into a clear, realistic time block (e.g. "Thursday 3:00 PM - 5:00 PM" or "Today 6:00 PM - 8:00 PM").
           - Generate a brief studyGuide/checklist (markdown bullets) with sub-steps.
        
        Format your response EXACTLY as a JSON object:
        {
          "reply": "your text response explaining what you did and where you scheduled it",
          "tasks": [
            {
              "title": "task title",
              "dueDate": "estimated due date description",
              "duration": "duration",
              "urgency": "high" | "medium" | "low",
              "category": "work" | "personal" | "study",
              "scheduledTime": "Day HH:MM AM/PM - HH:MM AM/PM",
              "studyGuide": "bullet list of guide"
            }
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      // Clean up markdown block styling if present
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const newTasks: Task[] = (parsed.tasks || []).map((t: any, index: number) => ({
        ...t,
        id: `task-${Date.now()}-${index}`,
        completed: false
      }));

      return {
        reply: parsed.reply || "Done! I've updated your schedule.",
        newTasks
      };
    } catch (e) {
      console.error("Gemini API error, falling back to local processing:", e);
    }
  }

  // Local Processing fallback (acts like a local agent)
  for (const handler of MOCK_AURA_RESPONSES) {
    if (handler.trigger.some(word => normalizedText.includes(word))) {
      const result = handler.getResponse(text, tone);
      const newTasks: Task[] = result.tasks.map((t, idx) => ({
        ...t,
        id: `task-${Date.now()}-${idx}`,
        completed: false
      }));
      return {
        reply: result.reply,
        newTasks
      };
    }
  }

  // Standard generic response if no keywords hit
  let fallbackReply = `I noted your message: "${text}". I have added it as a high priority item to your tasks list and will assist you in preparing for it.`;
  if (tone === 'aggressive') {
    fallbackReply = `Fine, I created a task for "${text}". I scheduled it for tonight at 7 PM. Stop stalling and get it done!`;
  } else if (tone === 'encouraging') {
    fallbackReply = `I've added "${text}" to your checklist for tonight at 7 PM. You're doing amazing, take it one step at a time! 🦖`;
  }

  return {
    reply: fallbackReply,
    newTasks: [
      {
        id: `task-${Date.now()}`,
        title: text.length > 40 ? `${text.slice(0, 40)}...` : text,
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

export async function scanImageWithGemini(
  base64Data: string,
  mimeType: string,
  apiKey: string
): Promise<{ title: string; dueDate: string; urgency: 'high' | 'medium' | 'low'; description: string }> {
  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Analyze this screenshot/image (which represents a school assignment, a tuition schedule, or an email deadline).
      Extract the assignment title, due date, priority/urgency, and a brief description.
      
      Format your response EXACTLY as a JSON object:
      {
        "title": "extracted assignment/task title",
        "dueDate": "estimated due date e.g. May 27, 2026",
        "urgency": "high" | "medium" | "low",
        "description": "brief 1-sentence description of the assignment details detected"
      }
    `;

    const imageParts = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    const result = await model.generateContent([prompt, imageParts]);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error doing Gemini Multimodal Scan, using mock scan fallback:", error);
    throw error;
  }
}
