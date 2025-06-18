import {db, admin} from '../config/firebase.js';

//STORES A CHAT LOG IN FIRESTORE
// This function logs a chat between a user and the bot in Firestore.
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