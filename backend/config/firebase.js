import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

//INITALIZES FIREBASE ADMIN SDK
//This file is used to initialize the Firebase Admin SDK for server-side operations.
//Firebase storage -> inb-internal-project.firebasestorage.app

dotenv.config(); // Loads FIREBASE_CONFIG from .env or Render's env panel

// Ensure the env variable exists
if (!process.env.FIREBASE_CONFIG) {
  throw new Error('FIREBASE_CONFIG environment variable is not set');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.appspot.com`, // Optional: auto-connects storage
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket(); // This now connects using project_id from above

export { admin, db, bucket };