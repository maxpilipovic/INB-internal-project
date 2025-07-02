import admin from 'firebase-admin';
import dotenv from 'dotenv';

//INITALIZES FIREBASE ADMIN SDK
//This file is used to initialize the Firebase Admin SDK for server-side operations.
//Firebase storage -> inb-internal-project.firebasestorage.app

dotenv.config();

if (!process.env.FIREBASE_CONFIG) {
  throw new Error('FIREBASE_CONFIG env var not found');
}

let parsedConfig;
try {
  parsedConfig = JSON.parse(process.env.FIREBASE_CONFIG); //parse first
  //Now fixff
  parsedConfig.private_key = parsedConfig.private_key.replace(/\\n/g, '\n');
} catch (err) {
  console.error('Failed to parse FIREBASE_CONFIG:', err.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(parsedConfig),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export { admin, db, bucket };