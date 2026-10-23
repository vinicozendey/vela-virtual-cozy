import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const configured = demoMode || Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
export const app: FirebaseApp | null = typeof window !== 'undefined' && !demoMode && configured ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
if (auth && process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && !auth.emulatorConfig) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

