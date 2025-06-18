import React from 'react';

function MessageBubble({ sender, text, showConfirmButtons, onConfirm }) {
    return (
        <div className={`chat-message ${sender}`}>
            <strong>{sender === 'user' ? 'You' : 'Bot'}:</strong> {text}

            {showConfirmButtons && (
              <div className="confirmation-buttons">
                <button onClick={() => onConfirm('Yes')}>Yes, create a ticket</button>
                <button onClick={() => onConfirm('No')}>No thanks</button>
              </div>
            )}
        </div>
    );
}

export default MessageBubble;