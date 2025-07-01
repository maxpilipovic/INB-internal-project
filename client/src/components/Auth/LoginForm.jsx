import { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from '../../services/firebaseClient';
import toast from 'react-hot-toast';

function Login({ onLogin }) {
  const backendURL1 = import.meta.env.VITE_BACKEND_URL1;
  const backendURL2 = import.meta.env.VITE_BACKEND_URL2;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Please enter your email to reset password');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
    } catch (err) {
      console.error('Password reset failed:', err);
      toast.error(err.message || 'Failed to send reset email');
    }
  };

  const handleAuth = async (e) => {

    e.preventDefault();
    
    try {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (isRegistering && emailDomain !== 'inb.com') {
        toast.error('Only INB email addresses are allowed to register.');
        return;
      }

      let userCredential;
      if (isRegistering) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        toast.success('Registered! Please check your email to verify your account.');

        setIsRegistering(false);
        return; //Stop here!!! don't allow login until verified
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
          toast.error('Please verify your email before logging in.');
          await signOut(auth); //Log them out
          return;
        }

        toast.success('Login successful!');
        onLogin({ uid: user.uid, email: user.email });

        //Send to backend
        fetch(`${backendURL1}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
          }),
        });
      }

    } catch (err) {
      console.error('Auth failed', err);
      toast.error('Login failed!', {
        duration: 3000,
      });
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">

        <h1 className="version-label">Version 2.2.1</h1>
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

        {!isRegistering && (
          <p className="forgot-password" onClick={handleForgotPassword}>
            Forgot Password
          </p>
        )}
        
      </div>

      <div className="dev-log-box">
        <h3>Dev Logs</h3>
        <h3>AS OF 06/30/2025. You must recreate an account.</h3>
        <ul>
          <li><strong>v2.2.1</strong> - Added state management</li>
          <li><strong>v2.2.0</strong> - Email verification, notifications, reset password</li>
          <li><strong>v2.1.0</strong> - Fixed slow login page</li>
        </ul>
      </div>
    </div>
  );
}

export default Login;