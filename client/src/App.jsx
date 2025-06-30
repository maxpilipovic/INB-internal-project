import { useState } from 'react';
import './styles/App.css';
import ChatLayout from './components/Chat/ChatLayout';
import LoginForm from './components/Auth/LoginForm';
import { Toaster } from 'react-hot-toast';


function App() {
  const backendURL1 = import.meta.env.VITE_BACKEND_URL1;
  const backendURL2 = import.meta.env.VITE_BACKEND_URL2;
  const [user, setUser] = useState(null);
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [ticketPreview, setTicketPreview] = useState(null);

  //Adding isTyping functionality.
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {

    if (!input.trim()) return;

    const userMsg = { sender: 'user', text: input };
    setChat(prev => [...prev, userMsg]);
    setIsTyping(true); // Set typing state to true

    try {
      const res = await fetch(`${backendURL2}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, uid: user.uid })
      });

      const data = await res.json();
      const botMsg = {
        sender: 'bot',
        text: data.reply,
        showConfirmButtons: data.awaitingTicketConfirmation || false
      };
      setChat(prev => [...prev, botMsg]);

      setInput('');
    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong.' };
      setChat(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false); // Reset typing state
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

      files.forEach(file => {
        formData.append('attachments', file);
      });

      const res = await fetch(`${backendURL2}/api/chat/confirm-ticket`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      const botMsg = { sender: 'bot', text: data.reply };
      setChat(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong submitting your ticket.' };
      setChat(prev => [...prev, errorMsg]);
    }
  };

  const handleTicketPreview = async () => {
    try {
      const res = await fetch(`${backendURL2}/api/chat/preview-ticket`, {
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

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      {user ? (
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
      ) : (
        <LoginForm onLogin={setUser} />
      )}
    </>
  );
}

export default App;
