import React from 'react';

function MessageBubble({ sender, text, showConfirmButtons, onConfirm, onPreview }) {

  //MessageBubble component displays an individual chat message styled based on the sender ('user' or 'bot').
  //It shows the sender label ("You" for user, "Bot" for chatbot) followed by the message text.
  //If `showConfirmButtons` is true, it renders action buttons to allow the user to preview a ticket,
  //confirm ticket creation ("Yes"), or cancel ("No").
  //The `onConfirm` and `onPreview` callbacks handle the respective button actions.
    return (
        <div className={`chat-message ${sender}`}>
            <strong>{sender === 'user' ? 'You' : 'Bot'}:</strong> {text}

            {showConfirmButtons && (
              <div className="confirmation-buttons">
                <button onClick={() => onPreview()}>Preview Ticket</button>
                <button onClick={() => onConfirm('Yes')}>Yes, create a ticket</button>
                <button onClick={() => onConfirm('No')}>No thanks</button>
              </div>
            )}
        </div>
    );
}

export default MessageBubble;