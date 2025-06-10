import React from 'react';

function ChatLayout({chat, input, setInput, sendMessage}) {
  return (
    <div className="chat-container">
      <h1>INB, N.A IT Support Chatbot</h1>
      <div className="chat-box">
        {chat.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.sender}`}>
            <strong>{msg.sender === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
          </div>
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