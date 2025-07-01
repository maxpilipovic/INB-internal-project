import { admin, db } from '../config/firebase.js'; // Must be the Admin SDK db
import { Timestamp } from 'firebase-admin/firestore';
import { generateTitleFromMessage } from './titleGenerator.js';

export async function logChat(uid, userMessage, botReply, chatId = null) {
  try {
    const chatMessagePair = [
      { sender: "user", text: userMessage },
      { sender: "bot", text: botReply },
    ];

    const userRef = db.collection('users').doc(uid);
    const chatsRef = userRef.collection('chats');

    if (chatId) {
      const chatDocRef = chatsRef.doc(chatId);
      await chatDocRef.update({
        messages: admin.firestore.FieldValue.arrayUnion(...chatMessagePair),
        updatedAt: Timestamp.now(),
      });
      return chatId;
    } else {
      const rawTitle = await generateTitleFromMessage(userMessage);
      const title = String(rawTitle).replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();

      const newChatRef = await chatsRef.add({
        title: title,
        messages: chatMessagePair,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return newChatRef.id;
    }
  } catch (err) {
    console.error("❌ Error logging chat:", err);
    return null;
  }
}