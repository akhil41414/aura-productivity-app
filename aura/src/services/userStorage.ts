/**
 * Per-user localStorage helpers.
 * Every piece of user data (tasks, chat history, timetable, etc.) is stored
 * under a key namespaced with the signed-in user's Firebase uid, so two
 * different Google accounts never see each other's data, and each user's
 * data is restored automatically the next time they sign back in.
 */

export const userKey = (base: string, uid: string | null): string =>
  uid ? `${base}_${uid}` : base;

export const getUserItem = (base: string, uid: string | null): string | null => {
  if (!uid) return null;
  return localStorage.getItem(userKey(base, uid));
};

export const setUserItem = (base: string, uid: string | null, value: string): void => {
  if (!uid) return; // never write user data when signed out
  localStorage.setItem(userKey(base, uid), value);
};

export const removeUserItem = (base: string, uid: string | null): void => {
  if (!uid) return;
  localStorage.removeItem(userKey(base, uid));
};

/** True if this uid has never had any data saved before (brand-new user). */
export const isNewUser = (uid: string | null): boolean => {
  if (!uid) return true;
  return localStorage.getItem(userKey('aura_timetable_profile', uid)) === null &&
         localStorage.getItem(userKey('aura_tasks', uid)) === null;
};
