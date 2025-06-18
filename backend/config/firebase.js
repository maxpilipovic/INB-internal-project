import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

//INITALIZES FIREBASE ADMIN SDK
//This file is used to initialize the Firebase Admin SDK for server-side operations.

dotenv.config();

const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };