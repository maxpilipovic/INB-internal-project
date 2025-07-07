import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

function ChatLayout({
  chat,
  input,
  setInput,
  sendMessage,
  handleTicketConfirmation,
  handleTicketPreview,
  isTyping,
  ticketPreview,
  setTicketPreview,
  awaitingPreviewConfirmation,
  setAwaitingPreviewConfirmation,
  isMobileMenuOpen,
  setIsMobileMenuOpen 
}) {
  const [files, setFiles] = useState([]);
  const messageEndRef = useRef();
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        console.log('✅ Logged out');
        navigate('/login');
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
      {/* Mobile Hamburger Button */}
      <div className="alpha-container">
        <button 
          className="hamburger-button"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
        >
          ☰
        </button>
        <h1>INB, N.A IT Support Chatbot</h1>

        {/* Logout Button */}
      <button className="logout-button" onClick={handleLogout}>Logout</button>
      </div>

      <div className="chat-box">
        {chat.map((msg, i) => (
          <MessageBubble
            key={i}
            sender={msg.sender}
            text={msg.text}
            showConfirmButtons={msg.showConfirmButtons}
            onConfirm={(text) => handleTicketConfirmation(text, files)}
            onPreview={handleTicketPreview}
          />
        ))}

        {isTyping && (
          <div className="typing-indicator">
            <em>Bot is typing...</em>
          </div>
        )}

        <div ref={messageEndRef} />

        {awaitingPreviewConfirmation && !ticketPreview && (
          <div className="ticket-confirmation-box">
            <p>🧐 It looks like you might want to open a ticket. Would you like to preview it first?</p>
            <div className="button-group">
              <button onClick={handleTicketPreview}>Yes, show preview</button>
              <button onClick={() => setAwaitingPreviewConfirmation(false)}>No thanks</button>
            </div>
          </div>
        )}

        {ticketPreview && (
          <div className="ticket-preview-box">
            <h3>🎟️ Ticket Preview</h3>
            <p><strong>Subject:</strong> {ticketPreview.subject}</p>
            <p><strong>Description:</strong> {ticketPreview.description}</p>
            <p><strong>Priority:</strong> {['Low', 'Medium', 'High', 'Urgent'][ticketPreview.priority - 1]}</p>
            <div className="button-group2">
              <button onClick={() => {
                handleTicketConfirmation("submit ticket", files, () => {
                setFiles([]);
                setTicketPreview(null); //Hides the preview after submission
                });
              }}>
                ✅ Submit Ticket
              </button>
              <button onClick={() => {
                setTicketPreview(null);
              }}>❌ Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="input-area">
        <form onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}>
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
