import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

export default function nextConfig(phase) {
  // App Hosting provides this JSON when the backend is linked to a Firebase Web App.
  const firebase = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}');
  const env = {};
  for (const [name, field] of Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: 'apiKey',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'appId',
  })) {
    const value = process.env[name] || firebase[field] || '';
    if (phase === PHASE_PRODUCTION_BUILD && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' && !value) {
      throw new Error(`Missing ${name}. Configure the root .env.local or link a Firebase Web App to App Hosting.`);
    }
    env[name] = value;
    process.env[name] = value;
  }
  return {
    env,
    async headers() {
      return [
        { source: '/v/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] },
      ];
    },
  };
}
