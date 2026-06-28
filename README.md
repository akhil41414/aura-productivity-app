# Aura - The Last-Minute Life Saver 🦖

Aura is a proactive, AI-powered productivity companion designed for students, professionals, and entrepreneurs. Unlike passive task-managers that rely on easy-to-ignore lists, Aura acts as a supportive friend who helps you manage time crunch, prioritize tasks dynamically, and schedule study blocks to ensure you never miss a deadline.

## 📋 Problem Statement Selected
**Problem Statement 1 - The Last-Minute Life Saver** (Coding Ninjas x Google for Developers VIBE 2 SHIP Hackathon)
*   **Challenge:** Build an AI-powered productivity companion that proactively assists users in planning, prioritizing, and completing tasks before deadlines are missed.

---

## ✨ Key Features

1.  **Google Authentication & Per-User Data Isolation**
    *   Secure login powered by **Firebase Authentication** (Google Sign-In).
    *   Complete separation of tasks, chat logs, and timetable settings per user UID. Your data is privately restored when you log back in.
2.  **Intelligent Task Prioritization & Sweeps**
    *   Aura dynamically analyzes your workload and triggers an *Escalation Mode* (last-minute notifications) if a high-urgency task is due soon.
    *   *Red Wall of Guilt:* Shows you overdue tasks and lets you sweep them to free evening slots with a single click.
3.  **Proactive AI-Powered Schedule Grid**
    *   A local schedule grid that automatically blocks out school, classes, and tuition commitments.
    *   Dynamically allocates study sessions and fit tasks directly into free slots without user intervention.
4.  **Context-Aware Native Notifications**
    *   Prompts browser Notification permissions on first load.
    *   Automatically schedules local alerts at **2 days before**, **2 hours before**, or at a **custom reminder time** extracted from chat logs (e.g. *"remind me 45 mins before"* or *"remind me at 5:30pm"*).
    *   Clicking a desktop notification automatically focuses the window, opens the Tasks tab, scrolls the specific task card into view, and highlights it with a glowing purple ring.
5.  **Email Alerts on Authentication**
    *   Nodemailer integration sends a secure sign-in alert email containing access details (name, email, timestamp, and remote IP address) whenever you log in or register.

---

## 🛠️ Technologies & Google Ecosystem Utilized

*   **Google AI Studio & Gemini API:** Google's `gemini-2.0-flash` and `gemini-2.0-flash-lite` drive the underlying scheduling engine, analyzing user inputs, calculating task difficulty, and structuring study guidelines.
*   **Firebase Authentication:** Secure, lightweight Google OAuth handler providing stable client-side authentication and session state.
*   **Frontend Stack:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide React.
*   **Backend Stack:** Node.js, Express, Nodemailer, and Google Gen AI SDK.
*   **Deployment:** Dockerfile configured for standard Google Cloud Run deployment.

---

## 🚀 Setup & Installation

### 1. Prerequisites
*   Node.js (v20+)
*   npm

### 2. Backend Environment Configuration
Create a `.env` file in the `server` directory (`server/.env`):
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key

# Email Alerts Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-16-character-app-password
EMAIL_ALERT_TO=recipient-email@gmail.com
```

### 3. Run Locally

**Start Backend (Terminal 1):**
```bash
npm run server
```

**Start Frontend (Terminal 2):**
```bash
npm start
```
Open **`http://localhost:5173/`** in your browser.
