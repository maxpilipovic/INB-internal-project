import { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../../services/firebaseClient';

function Login({ onLogin }) {
  const backendURL1 = import.meta.env.VITE_BACKEND_URL1;
  const backendURL2 = import.meta.env.VITE_BACKEND_URL2;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e) => {

    e.preventDefault();

    try {
      const userCredential = isRegistering
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);

      const user = userCredential.user;

      // Send to backend
      const res = await fetch(`${backendURL2}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
        }),
      });

      const data = await res.json();
      onLogin(data.user);
    } catch (err) {
      console.error('Auth failed', err);
      alert(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">

        <h1 className="version-label">Version 1.0.0</h1>
        <p className="description">
          Welcome to the INB IT Support Chatbot. This intelligent assistant is designed to help you resolve common technical issues, answer IT-related questions, and create support tickets when needed — all in real-time.
        </p>
        <p className="credits">
          Built by Max Pilipovic.
        </p>

        <h2>{isRegistering ? 'Register' : 'Login'} to INB IT Chatbot</h2>

        <form className="auth-form" onSubmit={handleAuth}>

          <input
            type="email"
            placeholder="INB Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button className="auth-button" type="submit">
            {isRegistering ? 'Create Account' : 'Login'}
          </button>
        </form>

        <p onClick={() => setIsRegistering(!isRegistering)} style={{ cursor: 'pointer' }}>
          {isRegistering ? 'Already have an account? Login' : 'No account? Register here'}
        </p>
      </div>
    </div>
  );
}

export default Login;