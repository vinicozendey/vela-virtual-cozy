import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = demoMode || Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
export const app: FirebaseApp | null = !demoMode && configured ? initializeApp(config) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
if (auth && import.meta.env.VITE_USE_EMULATORS === 'true') connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

