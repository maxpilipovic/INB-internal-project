//useState hook to manage state
import { useState } from 'react';

//Custom css import
import './App.css';

function App() {

  //Input: currrent user input
  //setInput: function to update input state
  const [input, setInput] = useState('');

  //Chat: array to hold chat messages
  //setChat: function to update chat state
  const [chat, setChat] = useState([]);

  //Function to send message
  const sendMessage = async () => {

    //Check if input is empty
    if (!input.trim()) return;

    //Create user message object and update chat state
    const userMsg = { sender: 'user', text: input };

    //Update chat state with user message
    setChat(prev => [...prev, userMsg]);
    
    //Post request to backend API
    try {
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }) //Send input as json
      });

      //Convert response to JSON
      const data = await res.json();

      //Create bot message object and update chat state
      const botMsg = { sender: 'bot', text: data.reply };
      setChat(prev => [...prev, botMsg]);

      //Clear input field after sending message
      setInput('');
      
      //Error catching
    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong.' };
      setChat(prev => [...prev, errorMsg]);
    }
  };

  return (
    <div className="App">
      <h1>INB, N.A Support Chat Bot</h1>
      <div className="chat-box">
        {chat.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.sender}`}>
            <strong>{msg.sender === 'user' ? 'You' : 'Bot'}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <div className="input-section">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask your IT question..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;