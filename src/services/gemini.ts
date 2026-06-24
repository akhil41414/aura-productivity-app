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

// Fallback response library to handle cases where API key is missing or offline
const MOCK_AURA_RESPONSES = [
  {
    trigger: ['homework', 'assignment', 'project', 'due', 'math', 'history', 'physics', 'essay'],
    getResponse: (text: string): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      const match = text.match(/(math|history|physics|essay|science|project|assignment)/i);
      const subject = match ? match[0] : 'Project';
      const title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Assignment`;
      return {
        reply: `I've analyzed your request. I scheduled a 2-hour deep-work block for your **${title}** on Thursday from 3:00 PM to 5:00 PM. I also generated a sub-task outline and resources to help you start immediately. Let me know if you want to shift this time.`,
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
    getResponse: (text: string): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      const match = text.match(/(rent|electricity|bill|subscription|netflix|spotify)/i);
      const billType = match ? match[0] : 'Bill';
      const title = `Pay ${billType.charAt(0).toUpperCase() + billType.slice(1)}`;
      return {
        reply: `I noted your **${title}**. I added a highly visible task for it. I've also fetched the payment link portal (simulated) so you can pay with one click from the task item.`,
        tasks: [
          {
            title: title,
            dueDate: 'Tomorrow',
            duration: '15 mins',
            urgency: 'high',
            category: 'personal',
            scheduledTime: 'Today 6:00 PM - 6:15 PM',
            studyGuide: '• Click action portal\n• Complete secure payment transfer\n• Download PDF receipt.'
          }
        ]
      };
    }
  },
  {
    trigger: ['gym', 'workout', 'run', 'exercise', 'health'],
    getResponse: (): { reply: string; tasks: Omit<Task, 'id' | 'completed'>[] } => {
      return {
        reply: `Awesome! Keeping fit keeps the mind sharp. I've scheduled a 45-minute workout block for you today at 5:00 PM. No excuses!`,
        tasks: [
          {
            title: 'Fitness Session',
            dueDate: 'Today 5:00 PM',
            duration: '45 mins',
            urgency: 'medium',
            category: 'personal',
            scheduledTime: 'Today 5:00 PM - 5:45 PM',
            studyGuide: '• 10m Warmup stretch\n• 30m Core workout or jogging\n• 5m Cooldown.'
          }
        ]
      };
    }
  }
];

export async function processAuraCommand(
  text: string,
  apiKey?: string
): Promise<{ reply: string; newTasks: Task[] }> {
  const normalizedText = text.toLowerCase();

  // If API Key is provided, use Google Generative AI
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
        You are "Aura", an autonomous, proactive, extremely helpful productivity assistant.
        The user has given you this request: "${text}"
        
        Analyze the request and do the following:
        1. Formulate a friendly, direct, human-like response (no robotic AI phrasing). 
        2. Extract any tasks that need to be created.
        3. For each task:
           - Provide a title.
           - Determine a realistic duration (e.g. "45 mins", "2 hours").
           - Assign urgency ('high' | 'medium' | 'low') based on priority.
           - Assign a category ('work' | 'personal' | 'study').
           - Schedule it into a clear, realistic time block (e.g. "Thursday 3:00 PM - 5:00 PM").
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
      const result = handler.getResponse(text);
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
  return {
    reply: `I noted your message: "${text}". I have added it as a high priority item to your tasks list and will assist you in preparing for it.`,
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
