/**
 * Real Google Calendar + Google Classroom integration using Google Identity
 * Services (GIS) incremental OAuth. This is separate from Firebase Auth
 * (which only grants basic profile info) — Calendar/Classroom access
 * requires extra scopes the user explicitly grants via a Google consent
 * screen the first time they tap "Connect".
 *
 * SETUP REQUIRED (one-time, in Google Cloud Console — same project as Firebase):
 * 1. console.cloud.google.com -> select the same project as your Firebase app.
 * 2. APIs & Services -> Library -> enable "Google Calendar API" and
 *    "Google Classroom API".
 * 3. APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
 *    -> Application type: Web application -> add your localhost and AI Studio
 *    deployment URL under "Authorized JavaScript origins".
 * 4. Copy the Client ID it gives you and paste it into GOOGLE_OAUTH_CLIENT_ID
 *    below.
 * 5. OAuth consent screen -> add yourself as a test user if the app is in
 *    "Testing" publishing status (normal for a hackathon demo).
 */

export const GOOGLE_OAUTH_CLIENT_ID = 'YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly'
].join(' ');

declare global {
  interface Window {
    google?: any;
  }
}

let gisScriptLoaded = false;
let accessToken: string | null = null;
let tokenScopes = '';

const loadGisScript = (): Promise<void> => {
  if (gisScriptLoaded && window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => { gisScriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
    document.head.appendChild(script);
  });
};

/**
 * Requests an OAuth access token covering the given scope(s). If we already
 * hold a token that covers the requested scope, reuses it instead of
 * re-prompting the user.
 */
const requestAccessToken = (scope: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (accessToken && tokenScopes.includes(scope)) {
      resolve(accessToken);
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded yet.'));
      return;
    }
    const combinedScope = tokenScopes ? `${tokenScopes} ${scope}` : scope;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: combinedScope,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        tokenScopes = combinedScope;
        resolve(accessToken as string);
      }
    });
    client.requestAccessToken();
  });
};

export const connectGoogleCalendar = async (): Promise<void> => {
  await loadGisScript();
  await requestAccessToken(CALENDAR_SCOPE);
};

export const connectGoogleClassroom = async (): Promise<void> => {
  await loadGisScript();
  await requestAccessToken(CLASSROOM_SCOPES);
};

/**
 * Creates a real event on the user's primary Google Calendar.
 * dueDateISO / startISO / endISO must be full ISO datetime strings.
 */
export const createCalendarEvent = async (params: {
  title: string;
  description?: string;
  startISO: string;
  endISO: string;
}): Promise<{ id: string; htmlLink: string } | null> => {
  if (!accessToken) {
    throw new Error('Calendar is not connected yet.');
  }
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: params.title,
        description: params.description || 'Scheduled by Aura',
        start: { dateTime: params.startISO },
        end: { dateTime: params.endISO }
      })
    }
  );
  if (!res.ok) {
    console.error('[Calendar] Failed to create event:', await res.text());
    return null;
  }
  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
};

/**
 * Fetches the user's active Classroom courses and recent coursework
 * (assignments). Returns a flat list ready to be turned into Aura tasks.
 */
export const fetchClassroomAssignments = async (): Promise<
  { courseName: string; title: string; dueDate: string | null }[]
> => {
  if (!accessToken) {
    throw new Error('Classroom is not connected yet.');
  }
  const coursesRes = await fetch(
    'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!coursesRes.ok) {
    console.error('[Classroom] Failed to fetch courses:', await coursesRes.text());
    return [];
  }
  const coursesData = await coursesRes.json();
  const courses = coursesData.courses || [];

  const results: { courseName: string; title: string; dueDate: string | null }[] = [];

  for (const course of courses) {
    const workRes = await fetch(
      `https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!workRes.ok) continue;
    const workData = await workRes.json();
    for (const work of workData.courseWork || []) {
      let dueDate: string | null = null;
      if (work.dueDate) {
        const { year, month, day } = work.dueDate;
        dueDate = `${month}/${day}/${year}`;
      }
      results.push({
        courseName: course.name,
        title: work.title,
        dueDate
      });
    }
  }
  return results;
};

export const isCalendarConnected = (): boolean => !!accessToken && tokenScopes.includes(CALENDAR_SCOPE);
export const isClassroomConnected = (): boolean =>
  !!accessToken && CLASSROOM_SCOPES.split(' ').every(s => tokenScopes.includes(s));
