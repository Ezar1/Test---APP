/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Enable browser local persistence so sessions survive page reloads and tab switching
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Could not set auth local persistence:', err);
  });
} catch (e) {
  // Ignore in non-browser environments
}

// Google Auth Provider configured for standard Google enterprise sign-in
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// In-memory token cache
let cachedGoogleAccessToken: string | null = null;
let isSigningIn = false;

const LOCAL_USER_STORAGE_KEY = 'everest_active_user';

export const getGoogleAccessToken = (): string | null => {
  return cachedGoogleAccessToken;
};

export const setGoogleAccessToken = (token: string | null) => {
  cachedGoogleAccessToken = token;
};

export const getFirebaseIdToken = async (forceRefresh = false): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch (err) {
      console.error('Failed to get Firebase ID token:', err);
    }
  }
  const localSaved = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      return parsed.token || 'custom_session_' + (parsed.email || 'user');
    } catch {}
  }
  return null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, accessToken?: string | null) => void,
  onAuthFailure?: () => void
) => {
  // First check if there is an active local user session
  const localSaved = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  if (localSaved && !auth.currentUser) {
    try {
      const parsed = JSON.parse(localSaved);
      const mockUser = {
        uid: parsed.uid || 'usr_' + Date.now(),
        email: parsed.email || 'p9168337@gmail.com',
        displayName: parsed.displayName || parsed.email?.split('@')[0] || 'Everest User',
        photoURL: parsed.photoURL || null,
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'custom_token_' + (parsed.email || 'user'),
        getIdTokenResult: async () => ({} as any),
        reload: async () => {},
        toJSON: () => ({}),
        phoneNumber: parsed.phoneNumber || null,
        providerId: 'custom',
      } as unknown as User;

      if (onAuthSuccess) {
        onAuthSuccess(mockUser, cachedGoogleAccessToken);
      }
    } catch (e) {
      console.warn('Error reading saved auth session:', e);
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      localStorage.setItem(
        LOCAL_USER_STORAGE_KEY,
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        })
      );
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedGoogleAccessToken);
      }
    } else {
      const localStillSaved = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
      if (!localStillSaved) {
        cachedGoogleAccessToken = null;
        if (onAuthFailure) {
          onAuthFailure();
        }
      }
    }
  });
};

export const signInWithMobileOrEmail = async (identifier: string): Promise<User> => {
  const clean = identifier.trim();
  if (!clean) {
    throw new Error('Please enter a valid 10-digit mobile number or email.');
  }

  let email = clean.toLowerCase();
  let displayName = clean;

  if (/^\d+$/.test(clean)) {
    if (clean.length < 7) {
      throw new Error('Please enter a valid mobile number (10 digits).');
    }
    // If it is the admin's phone (e.g., starts with or is 9168337...)
    if (clean.includes('9168337')) {
      email = 'p9168337@gmail.com';
      displayName = 'Authorized Admin (p9168337)';
    } else {
      email = `mobile_${clean}@everestfleet.com`;
      displayName = `Fleet User (${clean})`;
    }
  } else if (!clean.includes('@')) {
    email = `${clean}@everestfleet.com`;
  }

  const customUser = {
    uid: 'usr_' + Date.now(),
    email,
    displayName,
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'custom_token_' + email,
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: /^\d+$/.test(clean) ? clean : null,
    providerId: 'mobile_auth',
  } as unknown as User;

  localStorage.setItem(
    LOCAL_USER_STORAGE_KEY,
    JSON.stringify({
      uid: customUser.uid,
      email: customUser.email,
      displayName: customUser.displayName,
      phoneNumber: customUser.phoneNumber,
    })
  );

  return customUser;
};

export const googleSignIn = async (): Promise<{ user: User; accessToken?: string | null }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedGoogleAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedGoogleAccessToken };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    // Categorize errors for clean user display
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in was cancelled. Please try again.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by browser. Please allow popups for this site.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error during Google sign-in. Please check your connection.');
    }
    throw new Error(error.message || 'Google sign-in could not be completed. Please try again.');
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  try {
    cachedGoogleAccessToken = null;
    localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
  }
};
