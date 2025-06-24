import React from 'react';
import MessageBubble from './MessageBubble';

function ChatLayout({chat, input, setInput, sendMessage, handleTicketConfirmation}) {

  const [files, setFiles] = React.useState([]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

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
            onConfirm={(text) => handleTicketConfirmation(text, files)} //Pass file now
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
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ marginTop: '10px' }}
        />
        <div>
          {files.map((file, index) => (
            <div key={index}>
              {file.name}
              <button type="button" onClick={() => removeFile(index)}>Remove</button>
            </div>
          ))}
        </div>
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatLayout;