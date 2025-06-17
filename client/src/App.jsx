//useState hook to manage state
import { useState } from 'react';

//Custom css import
import './App.css';
import ChatLayout from './chatLayout';

function App() {

  //Input: currrent user input
  //setInput: function to update input state
  const [input, setInput] = useState('');

  //Chat: array to hold chat messages
  //setChat: function to update chat state
  const [chat, setChat] = useState([]);

  const[ticketContext, setTicketContext] = useState('');

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
      const botMsg = { sender: 'bot', text: data.reply, showConfirmButtons: data.awaitingTicketConfirmation || false };
      setChat(prev => [...prev, botMsg]);

      if (data.awaitingTicketConfirmation) {
        setTicketContext(input); // Store the context for ticket confirmation
      }

      //Clear input field after sending message
      setInput('');
      
      //Error catching
    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong.' };
      setChat(prev => [...prev, errorMsg]);
    }
  };

  const handleTicketConfirmation = async (responseText) => {
  const userMsg = { sender: 'user', text: responseText };
  setChat(prev => [...prev, userMsg]);

  try {
    const res = await fetch('http://localhost:5000/api/chat/confirm-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: responseText,
        ticketContext: ticketContext, // <-- send original issue here
      }),
    });

    const data = await res.json();
    const botMsg = { sender: 'bot', text: data.reply };
    setChat(prev => [...prev, botMsg]);
  } catch (error) {
    const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong submitting your ticket.' };
    setChat(prev => [...prev, errorMsg]);
  }
};

  return (
    <ChatLayout
      chat={chat}
      input={input}
      setInput={setInput}
      sendMessage={sendMessage}
      handleTicketConfirmation={handleTicketConfirmation}
    />  
  );
}

export default App;