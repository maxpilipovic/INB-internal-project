import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebaseClient';
import '../../styles/ChatSideBar.css';

function ChatSidebar({ uid, onSelectChat, onNewChat, activeChatId }) {
  const [chats, setChats] = useState([]);

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
