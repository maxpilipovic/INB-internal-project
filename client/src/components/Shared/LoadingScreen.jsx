import React from 'react';
import '../../styles/LoadingScreen.css'; // Make sure this path is correct

function LoadingScreen({ text = 'Loading...' }) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p className="loading-text">{text}</p>
    </div>
  );
}

export default LoadingScreen;