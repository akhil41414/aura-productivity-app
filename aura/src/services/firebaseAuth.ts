import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';

// ============================================================================
// FIREBASE CONFIG — REPLACE THESE WITH YOUR OWN PROJECT'S VALUES
// ============================================================================
// 1. Go to https://console.firebase.google.com -> create/select a project.
// 2. Project Settings -> General -> "Your apps" -> Add app -> Web (</>).
// 3. Copy the config object it gives you and paste the values below.
// 4. Authentication -> Sign-in method -> enable "Google".
// 5. Authentication -> Settings -> Authorized domains -> add your AI Studio
//    deployment domain (and localhost is usually allowed by default).
// ============================================================================
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export interface AuraUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const toAuraUser = (user: User): AuraUser => ({
  uid: user.uid,
  displayName: user.displayName,
  email: user.email,
  photoURL: user.photoURL
});

export const signInWithGoogle = async (): Promise<AuraUser> => {
  const result = await signInWithPopup(auth, googleProvider);
  return toAuraUser(result.user);
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

/**
 * Subscribes to auth state changes. Calls `callback` with an AuraUser
 * (or null if signed out) whenever the auth state changes, including
 * on initial load (handles refresh/persisted sessions).
 */
export const subscribeToAuthChanges = (
  callback: (user: AuraUser | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user ? toAuraUser(user) : null);
  });
};
