import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only Firebase Admin SDK. Used by API routes (e.g. the WhatsApp
 * webhook) that need to write Firestore data without a signed-in browser
 * session — the Admin SDK authenticates as a service account and bypasses
 * firestore.rules entirely, which is exactly why this must never be
 * imported from client components.
 *
 * Credentials: set FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL /
 * FIREBASE_ADMIN_PRIVATE_KEY (from a downloaded service account JSON — paste
 * the private_key value as-is, escaped newlines are unescaped below), or
 * leave them unset to fall back to Application Default Credentials (e.g.
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a service account file).
 */
function buildAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminApp: App = buildAdminApp();
export const adminDb: Firestore = getFirestore(adminApp);
