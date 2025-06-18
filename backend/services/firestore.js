import {db, admin} from '../config/firebase.js';

export async function logChat(uid, userMessage, botReply) {
    try {
        await db.collection('users')
        .doc(uid)
        .collection('chats')
        .add({
            userMessage,
            botReply,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
        console.log('Chat logged successfully');
    } catch (err) {
        console.error('Error logging chat:', err);
    }
}