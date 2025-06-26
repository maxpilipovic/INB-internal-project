import express from 'express';
import { db, admin } from '../config/firebase.js';
import { sanitizeInput } from '../utils/sanitizeInput.js'
import { sanitizeEmail } from '../utils/sanitizeEmail.js';

const router = express.Router();

//Route to handle user authentication and storage
// Expects { uid: string, email: string } in request body

router.post('/', async (req, res) => {
  const { uid, email } = req.body;

  const sanitizedEmail = sanitizeEmail(email);

  try {
    await db.collection('users').doc(uid).set({
      uid,
      sanitizedEmail,
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, user: { uid, sanitizedEmail} });
  } catch (err) {
    console.error('Error storing user:', err);
    res.status(500).json({ success: false, error: 'Failed to store user' });
  }
});

export default router;
