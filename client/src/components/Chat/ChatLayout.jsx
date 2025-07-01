import React from 'react';
import MessageBubble from './MessageBubble';
import { useEffect, useRef} from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';


function ChatLayout({chat, input, setInput, sendMessage, handleTicketConfirmation, handleTicketPreview, isTyping, ticketPreview, setTicketPreview}) {

  const [files, setFiles] = React.useState([]);
  const messageEndRef = useRef();

  //For logout button
  const navigate = useNavigate(); // 🔁 Add this for redirect
  const auth = getAuth(); // 🔐 Firebase Auth

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        console.log('✅ Logged out');
        navigate('/login'); // or your login route
      })
      .catch((error) => {
        console.error('❌ Logout failed:', error);
      });
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  return (
    <div className="chat-container">
      <h1>INB, N.A IT Support Chatbot</h1>
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
      <div className="chat-box">
        {chat.map((msg, i) => (
          <MessageBubble 
            key={i}
            sender={msg.sender}
            text={msg.text}
            showConfirmButtons={msg.showConfirmButtons}
            onConfirm={(text) => handleTicketConfirmation(text, files)} //Pass file now
            onPreview={handleTicketPreview}
          />
        ))}

        {isTyping && (
          <div className="typing-indicator">
            <em>Bot is typing...</em>
          </div>
        )}
        <div ref={messageEndRef} />

        {ticketPreview && (
          <div className="ticket-preview-box">
            <h3>🎟️ Ticket Preview</h3>
            <p><strong>Subject:</strong> {ticketPreview.subject}</p>
            <p><strong>Description:</strong> {ticketPreview.description}</p>
            <p><strong>Priority:</strong> {['Low', 'Medium', 'High', 'Urgent'][ticketPreview.priority - 1]}</p>
            <button onClick={() => setTicketPreview(null)}>Clear Preview</button>
          </div>
        )}
      </div>
      <div className="input-area">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />

          <input
            type="file"
            multiple
            onChange={handleFileChange}
            style={{ marginTop: '10px' }}
          />

          <div>
            {files.map((file, index) => (
              <div key={index} className="file-preview">
                {file.name}
                <button type="button" onClick={() => removeFile(index)}>Remove</button>
              </div>
            ))}
          </div>

          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default ChatLayout;