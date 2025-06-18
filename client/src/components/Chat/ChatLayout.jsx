import React from 'react';
import MessageBubble from './MessageBubble';

function ChatLayout({chat, input, setInput, sendMessage, handleTicketConfirmation}) {
  return (
    <div className="chat-container">
      <h1>INB, N.A IT Support Chatbot</h1>
      <div className="chat-box">
        {chat.map((msg, i) => (
          <MessageBubble 
            key={i}
            sender={msg.sender}
            text={msg.text}
            showConfirmButtons={msg.showConfirmButtons}
            onConfirm={handleTicketConfirmation}
          />
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatLayout;