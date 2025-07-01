import { useEffect, useState } from 'react';
import './styles/App.css';
import ChatLayout from './components/Chat/ChatLayout';
import LoginForm from './components/Auth/LoginForm';
import { Toaster } from 'react-hot-toast';
import { auth } from './services/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingScreen from './components/Shared/LoadingScreen';
import ChatSidebar from './components/Sidebar/ChatSideBar';
import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  const backendURL1 = import.meta.env.VITE_BACKEND_URL1;
  const backendURL2 = import.meta.env.VITE_BACKEND_URL2;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [ticketPreview, setTicketPreview] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { sender: 'user', text: input };
    setChat(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch(`${backendURL1}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, uid: user.uid, chatId }),
      });

      const data = await res.json();

      if (data.chatId && data.chatId !== chatId) {
        setChatId(data.chatId); // ✅ Ensure sidebar reflects saved chat
      }

      const botMsg = {
        sender: 'bot',
        text: data.reply,
        showConfirmButtons: data.awaitingTicketConfirmation || false,
      };

      setChat(prev => [...prev, botMsg]);
      setInput('');
    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong.' };
      setChat(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleTicketConfirmation = async (responseText, files = []) => {
    const userMsg = { sender: 'user', text: responseText };
    setChat(prev => [...prev, userMsg]);

    try {
      const formData = new FormData();
      formData.append('message', responseText);
      formData.append('chatHistory', JSON.stringify(chat.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }))));
      formData.append('uid', user.uid);
      formData.append('chatId', chatId);

      files.forEach(file => {
        formData.append('attachments', file);
      });

      const res = await fetch(`${backendURL1}/api/chat/confirm-ticket`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.chatId && data.chatId !== chatId) {
        setChatId(data.chatId);
      }

      const botMsg = { sender: 'bot', text: data.reply };
      setChat(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong submitting your ticket.' };
      setChat(prev => [...prev, errorMsg]);
    }
  };

  const handleTicketPreview = async () => {
    try {
      const res = await fetch(`${backendURL1}/api/chat/preview-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: chat.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          uid: user.uid
        })
      });

      const data = await res.json();
      setTicketPreview(data.ticket);
    } catch (error) {
      console.error('Failed to preview ticket:', error);
    }
  };

  if (loading) return <LoadingScreen text="Authenticating user..." />;

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              <div className="app-container">
                <ChatSidebar
                  uid={user.uid}
                  activeChatId={chatId}
                  onSelectChat={async (chatDoc) => {
                    try {
                      const res = await fetch(`${backendURL1}/api/get-chat/${chatDoc.id}?uid=${user.uid}`);
                      const data = await res.json();
                      setChat(data.messages || []);
                      setChatId(chatDoc.id);
                    } catch (err) {
                      console.error('Failed to fetch chat messages:', err);
                    }
                  }}
                  onNewChat={() => {
                    setChat([]);
                    setChatId(null);
                  }}
                />
                <ChatLayout
                  chat={chat}
                  input={input}
                  setInput={setInput}
                  sendMessage={sendMessage}
                  handleTicketConfirmation={handleTicketConfirmation}
                  handleTicketPreview={handleTicketPreview}
                  user={user}
                  isTyping={isTyping}
                  ticketPreview={ticketPreview}
                  setTicketPreview={setTicketPreview}
                />
              </div>
            ) : (
              <Navigate to="/login" /> // 👈 Redirect to login if not logged in
            )
          }
        />
        <Route path="/login" element={<LoginForm onLogin={setUser} />} />
      </Routes>
    </>
  );
}

export default App;
