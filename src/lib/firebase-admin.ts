import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "@/config/env";

let app: App;

export function getFirebaseAdmin() {
  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    app = getApps()[0] as App;
  }
  
  return {
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
