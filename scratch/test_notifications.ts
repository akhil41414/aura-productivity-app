import { type Task, parseDueDate } from '../src/services/gemini.ts';
import { 
  getTaskDueDateTime, 
  hasSpecificTime, 
  extractCustomReminderTime, 
  getTaskReminders 
} from '../src/services/notificationService.ts';


// Mock current date as June 28, 2026, 12:00 PM for testing consistency
const mockNow = new Date('2026-06-28T12:00:00');

console.log('=== Aura Notification Logic Verification ===\n');

// Test Case 1: Base Due Date Extraction
console.log('Test Case 1: getTaskDueDateTime');
const task1: Task = {
  id: 't1',
  title: 'Calculus Assignment',
  dueDate: 'June 30, 2026',
  duration: '1 hour',
  urgency: 'high',
  category: 'study',
  completed: false,
  scheduledTime: 'June 30 4:30 PM - 6:00 PM'
};

const dueDateTime1 = getTaskDueDateTime(task1);
console.log(`Task Due Date: ${task1.dueDate}`);
console.log(`Task Scheduled Time: ${task1.scheduledTime}`);
console.log(`Parsed Combined Due Time: ${dueDateTime1.toLocaleString()}`);
console.log(`Has specific time: ${hasSpecificTime(task1)} (Expected: true)`);
console.log('');

// Test Case 2: No Specific Time (Defaulting to end of day and day-of reminder at 7:00 AM)
console.log('Test Case 2: No Specific Time Defaults');
const task2: Task = {
  id: 't2',
  title: 'History Reading',
  dueDate: 'June 30, 2026',
  duration: '30 mins',
  urgency: 'low',
  category: 'study',
  completed: false
};

const dueDateTime2 = getTaskDueDateTime(task2);
console.log(`Task Due Date: ${task2.dueDate}`);
console.log(`Parsed Due Time (Default): ${dueDateTime2.toLocaleString()}`);
console.log(`Has specific time: ${hasSpecificTime(task2)} (Expected: false)`);
const reminders2 = getTaskReminders(task2);
console.log('Reminders generated:');
reminders2.forEach(r => {
  console.log(` - [${r.type}] ${r.label} at ${r.time.toLocaleString()}`);
});
console.log('');

// Test Case 3: Custom Reminder String Parsing
console.log('Test Case 3: Custom Chat Reminder Parsing');
const chatMessage = 'I have to submit my assignment by June 30 at 6pm, can you remind me at 5:30pm';
const baseDue = getTaskDueDateTime({
  ...task2,
  dueDate: 'June 30, 2026 at 6:00 PM'
});
console.log(`Task Base Due Time parsed: ${baseDue.toLocaleString()}`);
const customRem = extractCustomReminderTime(chatMessage, baseDue);
console.log(`User Chat Command: "${chatMessage}"`);
console.log(`Parsed Custom Reminder Time: ${customRem ? customRem.toLocaleString() : 'FAILED'}`);
console.log('');

// Test Case 4: Relative Reminder String Parsing
console.log('Test Case 4: Relative Reminder Parsing ("remind me 30 mins before")');
const relChatMessage = 'submit project tomorrow, remind me 45 mins before';
const tomorrowDue = getTaskDueDateTime({
  ...task2,
  dueDate: 'Tomorrow at 4:00 PM',
  scheduledTime: 'Tomorrow 4:00 PM - 5:00 PM'
});
const relCustomRem = extractCustomReminderTime(relChatMessage, tomorrowDue);
console.log(`User Chat Command: "${relChatMessage}"`);
console.log(`Task Due Time: ${tomorrowDue.toLocaleString()}`);
console.log(`Parsed Relative Reminder Time: ${relCustomRem ? relCustomRem.toLocaleString() : 'FAILED'}`);
console.log('');
