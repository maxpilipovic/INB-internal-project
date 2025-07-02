import React from 'react';
import '../../styles/LoadingScreen.css'; // Make sure this path is correct

function LoadingScreen({ text = 'Loading...' }) {

  // LoadingScreen component provides a simple full-screen loading interface.
  // It displays a spinning animation (styled via CSS) and a customizable loading message (default: "Loading...").
  // Typically used during authentication checks or when fetching critical data before showing the main UI.
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p className="loading-text">{text}</p>
    </div>
  );
}

export default LoadingScreen;