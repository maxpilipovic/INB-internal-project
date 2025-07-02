import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebaseClient';
import '../../styles/ChatSideBar.css';

function ChatSidebar({ uid, onSelectChat, onNewChat, activeChatId }) {
  //STATES
  const [chats, setChats] = useState([]);

  /**
  * useEffect to subscribe to Firestore chats for the logged-in user.
  *
  * - Watches the 'users/{uid}/chats' subcollection.
  * - Orders chats by `updatedAt` in descending order (most recent first).
  * - Sets up a real-time listener using `onSnapshot` to automatically
  *   update local state (`setChats`) when new chats are added/updated.
  *
  * Cleanup:
  * - Returns an unsubscribe function to detach the listener when
  *   the component unmounts or when `uid` changes.
  */
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'users', uid, 'chats'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChats(chatList);
    });

    return () => unsubscribe();
  }, [uid]);

  /**
  * Sidebar component JSX structure rendering the chat list UI.
  *
  * - The outer `<aside>` element uses the "sidebar" class for styling.
  *
  * - Header section (`sidebar-header`):
  *   - Displays the title "💬 Chats" indicating the chat list.
  *   - Includes a "+ New" button that triggers the `onNewChat` callback 
  *     to create a new chat when clicked.
  *
  * - Chat list (`ul.chat-list`):
  *   - Maps over the `chats` array to render each chat as a list item (`li`).
  *   - Each `<li>` has a unique `key` based on the chat's `id`.
  *   - The `className` conditionally applies the "active" class if this chat
  *     matches the currently selected chat ID (`activeChatId`), visually highlighting it.
  *   - Clicking on a chat item triggers the `onSelectChat` callback,
  *     passing the chat object to update the active chat in the parent component.
  *   - Displays the chat's title, or "Untitled Chat" if the title is missing or empty.
  *
  * This structure provides a clean, interactive sidebar for users to
  * view and select existing chats or start a new chat.
  */
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>💬 Chats</h2>
        <button onClick={onNewChat}>+ New</button>
      </div>

      <ul className="chat-list">
        {chats.map(chat => (
          <li
            key={chat.id}
            className={activeChatId === chat.id ? 'active' : ''}
            onClick={() => onSelectChat(chat)}
          >
            <span>{chat.title || 'Untitled Chat'}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default ChatSidebar;
