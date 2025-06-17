import {db, admin} from '../config/firebase.js';

export async function logChat(userMessage, botReply) {
    try {
        await db.collection('chats').add({
            userMessage,
            botReply,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Chat logged successfully');
    } catch (err) {
        console.error('Error logging chat:', err);
    }
}