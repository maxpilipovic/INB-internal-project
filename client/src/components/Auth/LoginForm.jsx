import { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from '../../services/firebaseClient';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function LoginForm({ onLogin }) {
  //STATES
  const backendURL1 = import.meta.env.VITE_BACKEND_URL1;
  const backendURL2 = import.meta.env.VITE_BACKEND_URL2;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  //Programmatically redirect the user to another route after successful login or registration
  const navigate = useNavigate();

  /**
  * Sends a password reset email to the user via Firebase Authentication.
  *
  * 1. Checks if the user has entered an email.
  * 2. If no email is entered, shows an error toast and exits early.
  * 3. If email is provided, attempts to send a password reset email using Firebase.
  * 4. On success, shows a success toast to notify the user.
  * 5. On failure (e.g. invalid email, network issue), logs the error and shows a toast message.
  */

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

  /**
  * Handles both user registration and login using Firebase Authentication.
  *
  * Registration:
  * - Only allows registration with '@inb.com' domain.
  * - Creates a new user and sends a verification email.
  * - Prevents login until the email is verified.
  *
  * Login:
  * - Signs in the user with provided email/password.
  * - Ensures the user’s email is verified before granting access.
  * - On success, updates the global state via `onLogin`, navigates to the main app,
  *   and notifies the backend via a POST request.
  *
  * Error Handling:
  * - Catches and displays appropriate toast messages for registration and login failures.
  */
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
        navigate('/'); //Forces redirect to main app

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

  /**
  * Renders the login and registration form UI.
  *
  * Layout:
  * - Uses a centered login page with a styled box (`login-page` and `login-box`).
  * - Displays app version, a short description, and author credit.
  *
  * Authentication Form:
  * - Contains email and password fields, both required.
  * - The form handles both login and registration based on `isRegistering` state.
  * - On submission, `handleAuth` is triggered to process authentication logic.
  *
  * Conditional Rendering:
  * - The heading and submit button dynamically change text depending on mode (`Register` or `Login`).
  * - A toggle link allows the user to switch between login and registration modes.
  * - A "Forgot Password" link is shown only during login to trigger password reset via `handleForgotPassword`.
  */

  return (
    <div className="login-page">
      <div className="login-box">

        <h1 className="version-label">Version 6.0.1</h1>
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
    </div>
  );
}

export default LoginForm;