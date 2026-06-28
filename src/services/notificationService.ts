import { type Task, parseDueDate } from './gemini.ts';

/**
 * Helper to calculate the exact due date-time for a task,
 * combining the parsed dueDate date and any specific time found in
 * scheduledTime or the dueDate string.
 */
export function getTaskDueDateTime(task: Task): Date {
  const baseDate = parseDueDate(task.dueDate);
  
  // Try to extract time from scheduledTime or dueDate
  let timeStr = '';
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  
  if (task.scheduledTime) {
    const match = task.scheduledTime.match(timeRegex);
    if (match) {
      timeStr = match[0];
    }
  }
  
  if (!timeStr && task.dueDate) {
    const match = task.dueDate.match(timeRegex);
    if (match) {
      timeStr = match[0];
    }
  }

  if (timeStr) {
    const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const ampm = match[3].toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      baseDate.setHours(hours, minutes, 0, 0);
    }
  }
  
  return baseDate;
}

/**
 * Returns whether a task's due date string or scheduledTime has a specific time.
 */
export function hasSpecificTime(task: Task): boolean {
  const timeRegex = /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i;
  return (!!task.scheduledTime && timeRegex.test(task.scheduledTime)) || 
         (!!task.dueDate && timeRegex.test(task.dueDate));
}

/**
 * Extracts a custom reminder time from the raw message text,
 * relative to the task's base due date.
 * Returns null if no custom reminder instruction is found.
 */
export function extractCustomReminderTime(text: string, baseDueDate: Date): Date | null {
  const normalized = text.toLowerCase();
  
  // 1. Check relative patterns first (e.g., "remind me 45 mins before", "remind me 2 hours prior")
  const relativeRegex = /remind\s+me\s+(\d+)\s*(mins?|minutes?|hours?|hrs?)\s*(before|prior)/i;
  const relMatch = normalized.match(relativeRegex);
  if (relMatch) {
    const amount = parseInt(relMatch[1]);
    const unit = relMatch[2].toLowerCase();
    const multiplier = unit.startsWith('min') ? 60 * 1000 : 60 * 60 * 1000;
    return new Date(baseDueDate.getTime() - amount * multiplier);
  }
  
  // 2. Check absolute patterns (e.g., "remind me at 5:30pm", "remind me on Thursday at 4pm")
  const remindAtRegex = /remind\s+me\s+(?:on\s+(\w+)\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const match = normalized.match(remindAtRegex);
  if (match) {
    const dayWord = match[1]; // e.g. "tomorrow", "thursday"
    let hours = parseInt(match[2]);
    const minutes = match[3] ? parseInt(match[3]) : 0;
    const ampm = match[4];
    
    // Guard: hours must be valid clock hours (0-23)
    if (hours < 0 || hours > 23) {
      return null;
    }
    
    if (ampm) {
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    } else {
      // Default to PM for standard daily hours if not specified
      if (hours >= 1 && hours <= 7) {
        hours += 12;
      }
    }
    
    let targetDate = new Date(baseDueDate);
    if (dayWord) {
      if (dayWord === 'today') {
        targetDate = new Date();
      } else if (dayWord === 'tomorrow') {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 1);
      } else {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const idx = weekdays.indexOf(dayWord);
        if (idx !== -1) {
          const now = new Date();
          const currentDay = now.getDay();
          let diff = idx - currentDay;
          if (diff <= 0) diff += 7;
          targetDate = new Date();
          targetDate.setDate(now.getDate() + diff);
        }
      }
    }
    
    targetDate.setHours(hours, minutes, 0, 0);
    return targetDate;
  }
  
  return null;
}

/**
 * Requests permission for showing browser notifications.
 */
export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log(`[Notification Service] Permission status: ${permission}`);
    });
  }
}

/**
 * Retrieves the set of already fired reminder IDs from localStorage.
 */
function getFiredReminders(userId: string | null): Set<string> {
  const key = userId ? `aura_fired_reminders_${userId}` : 'aura_fired_reminders';
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return new Set(JSON.parse(saved));
    } catch {
      return new Set();
    }
  }
  return new Set();
}

/**
 * Saves the set of already fired reminder IDs to localStorage.
 */
function saveFiredReminders(userId: string | null, fired: Set<string>): void {
  const key = userId ? `aura_fired_reminders_${userId}` : 'aura_fired_reminders';
  localStorage.setItem(key, JSON.stringify(Array.from(fired)));
}

export interface ReminderAlert {
  time: Date;
  type: '2days' | '2hours' | 'dayof' | 'custom';
  label: string;
}

/**
 * Returns all potential reminder trigger dates for a given task.
 */
export function getTaskReminders(task: Task): ReminderAlert[] {
  if (task.completed || task.isSomeday) return [];
  
  const reminders: ReminderAlert[] = [];
  const dueDateTime = getTaskDueDateTime(task);
  const dueTimeMs = dueDateTime.getTime();
  
  // 1. Custom reminder if specified
  if (task.customReminderTime) {
    const customTime = new Date(task.customReminderTime);
    reminders.push({
      time: customTime,
      type: 'custom',
      label: `Custom Reminder`
    });
  }
  
  // 2. Default reminders
  // A. 2 days before the due date/time
  reminders.push({
    time: new Date(dueTimeMs - 2 * 24 * 60 * 60 * 1000),
    type: '2days',
    label: 'Due in 2 days'
  });
  
  // B. 2 hours before due date/time (if a specific time was mentioned) OR day-of at 7:00 AM (if no specific time mentioned)
  if (hasSpecificTime(task)) {
    reminders.push({
      time: new Date(dueTimeMs - 2 * 60 * 60 * 1000),
      type: '2hours',
      label: 'Due in 2 hours'
    });
  } else {
    // Default day-of reminder to 7:00 AM on that day
    const dayOf7AM = new Date(dueDateTime.getFullYear(), dueDateTime.getMonth(), dueDateTime.getDate(), 7, 0, 0);
    reminders.push({
      time: dayOf7AM,
      type: 'dayof',
      label: 'Due today'
    });
  }
  
  return reminders;
}

/**
 * Checks all tasks, finds any reminders that fall within the current trigger range
 * (i.e. due in the past up to 5 mins ago, or in the next 1 minute),
 * and triggers them if they haven't been fired already.
 */
export function checkAndTriggerReminders(
  tasks: Task[],
  userId: string | null,
  onTriggerTask: (task: Task) => void
): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  
  const now = Date.now();
  const fired = getFiredReminders(userId);
  let updatedFired = false;
  
  tasks.forEach(task => {
    const reminders = getTaskReminders(task);
    reminders.forEach(reminder => {
      const reminderId = `${task.id}_${reminder.type}_${reminder.time.getTime()}`;
      
      if (fired.has(reminderId)) {
        return;
      }
      
      const timeMs = reminder.time.getTime();
      
      // Fire if:
      // - Time is up to 5 minutes in the past (so we catch it if the tab was inactive or just opened)
      // - Time is up to 1 minute in the future (next minute check)
      const isDue = timeMs <= now + 60 * 1000 && timeMs >= now - 5 * 60 * 1000;
      
      if (isDue) {
        fired.add(reminderId);
        updatedFired = true;
        
        // Show Browser Notification
        try {
          const notification = new Notification('Aura Reminder 🦖', {
            body: `${reminder.label}: "${task.title}" (Due: ${task.dueDate})`,
            icon: '/favicon.ico',
            tag: task.id,
            requireInteraction: true
          });
          
          notification.onclick = () => {
            window.focus();
            onTriggerTask(task);
            notification.close();
          };
        } catch (e) {
          console.error('[Notification Service] Failed to trigger Notification API:', e);
        }
      }
    });
  });
  
  if (updatedFired) {
    saveFiredReminders(userId, fired);
  }
}
