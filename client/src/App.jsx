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

  //STATES
  const backendURL1 = import.meta.env.VITE_BACKEND_URL1;
  const backendURL2 = import.meta.env.VITE_BACKEND_URL2;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [ticketPreview, setTicketPreview] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [awaitingPreviewConfirmation, setAwaitingPreviewConfirmation] = useState(false);

  // This useEffect runs once when the App component mounts. It sets up a real-time listener
  // (onAuthStateChanged) to track the user's authentication state. Firebase automatically calls
  // this listener when:
  // - the user signs in or out
  // - the user's ID token is refreshed
  //
  // If a user is logged in *and* their email is verified, we update the local `user` state
  // with their UID and email. Otherwise, we clear the `user` state by setting it to null.
  //
  // This ensures our app knows whether to show the chat interface or redirect to the login screen.
  //
  // `setLoading(false)` is called after the auth check so we can conditionally show the app
  // only after the authentication state has been confirmed.
  //
  // The returned `unsubscribe()` function is cleanup — it removes the listener when the component unmounts
  // to prevent memory leaks or unintended re-renders.

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

  
  /**
  * Handles sending a user message to the chatbot and receiving the bot’s response.
  *
  * 1. Validates that the user is logged in and the input is not empty.
  * 2. Immediately appends the user’s message to the chat UI (`setChat`), providing a responsive experience.
  * 3. Sends the message to the backend API (`/api/chat`) with:
  *    - `message`: the text the user typed
  *    - `uid`: Firebase user ID for associating the chat
  *    - `chatId`: used to continue an existing chat session
  * 4. Awaits the bot's response and appends it to the chat.
  *    - If `data.awaitingTicketConfirmation` is true, the UI will show buttons for confirmation.
  *    - If a new `chatId` is returned, it updates state so the sidebar reflects the saved thread.
  * 5. Handles network or server errors gracefully by showing a fallback bot error message.
  * 6. Clears the input field and disables the typing indicator (`isTyping`) once complete.
  */

  const sendMessage = async () => {

    if (!input.trim() || !user?.uid) {
      toast.error("User not authenticated. Please log in again."); //ADDED THIS
      return;
    }

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
        setChatId(data.chatId); //Ensure sidebar reflects saved chat
      }

      const botMsg = {
        sender: 'bot',
        text: data.reply,
      };

      setChat(prev => [...prev, botMsg]);

      if (data.awaitingTicketPreview === true) {
        setAwaitingPreviewConfirmation(true);;
      }

      setInput('');

    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong.' };
      setChat(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  /**
  * Submits the user's final confirmation to create a support ticket.
  *
  * 1. Immediately appends the user's confirmation message to the chat.
  * 2. Constructs a `FormData` object with:
  *    - The confirmation text
  *    - The full chat history (mapped to user/assistant format)
  *    - The user's UID and current chat ID
  *    - Any uploaded files
  * 3. Sends this data to the backend `/api/chat/confirm-ticket` endpoint.
  * 4. If successful:
  *    - Updates the `chatId` if it changed
  *    - Appends the bot’s response (e.g. ticket created confirmation)
  * 5. If failed:
  *    - Appends a fallback bot error message.
  */

  const handleTicketConfirmation = async (responseText, files = [], onSuccess) => {
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

      if (onSuccess) onSuccess();

    } catch (error) {
      const errorMsg = { sender: 'bot', text: 'Sorry, something went wrong submitting your ticket.' };
      setChat(prev => [...prev, errorMsg]);
    }
  };

  /**
  * handleTicketPreview()
  * 
  * Generates a ticket preview based on the current chat history.
  * 
  * 1. Converts the `chat` state into OpenAI-style format:
  *    - Each message is mapped to `{ role: 'user' | 'assistant', content: '...' }`
  * 2. Sends this to the `/api/chat/preview-ticket` endpoint via POST.
  * 3. Includes the Firebase user UID so the backend can associate the request.
  * 4. Expects the backend to return a `ticket` object with:
  *    - Subject, description, priority, etc.
  * 5. Stores this result in `ticketPreview`, which triggers the UI to show a preview panel.
  * 
  * If the request fails, logs an error to the console.
  */

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
          uid: user.uid,
          chatId: chatId
        })
      });

      const data = await res.json();

      if (data.chatId && data.chatId !== chatId) {
        setChatId(data.chatId);
      }

      setTicketPreview(data.ticket);
      setAwaitingPreviewConfirmation(false); // user has confirmed and preview is shown

    } catch (error) {
      console.error('Failed to preview ticket:', error);
    }
  };

  //LOADING is true. Applies LoadingScreen.
  if (loading) return <LoadingScreen text="Authenticating user..." />;

  /**
  * Main routing logic for the application
  * 
  * - Uses `react-router-dom` to define page routes.
  * - Displays a global `Toaster` for success/error messages.
  * 
  * `/` route:
  *    X If the user is logged in and email is verified:
  *       - Renders the chatbot UI:
  *         - `ChatSidebar`: Displays list of previous chats, allows switching.
  *         - `ChatLayout`: Main chat window, input area, ticket features, etc.
  *    X If the user is not logged in:
  *       - Redirects to `/login` using `<Navigate />`
  * 
  * `/login` route:
  *    - Renders the `LoginForm` component.
  *    - Passes `setUser` so the main App knows when authentication completes.
  */
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

                      //RESET SHIT SO IT DOES NOT GO OVER
                      setTicketPreview(null);
                      setAwaitingPreviewConfirmation(false);
                      setIsTyping(false);
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
                  awaitingPreviewConfirmation={awaitingPreviewConfirmation}
                  setAwaitingPreviewConfirmation={setAwaitingPreviewConfirmation}
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
