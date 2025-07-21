<<<<<<< HEAD
# 🧠 INB IT Chatbot — Smart Helpdesk Assistant

This is a smart helpdesk chatbot web app built for INB that helps users describe technical issues and automatically drafts support tickets using AI (GPT). Built with **React**, **Firebase**, and **Node.js**, it offers a clean, responsive UI and powerful features for internal support at INB.
=======
# 🧠 IT Chatbot — Smart Helpdesk Assistant

This is a smart helpdesk chatbot web app that helps users describe technical issues and automatically drafts support tickets using AI (GPT). Built with **React**, **Firebase**, and **Node.js**, it offers a clean, responsive UI and powerful features for internal support at INB..
>>>>>>> 65fa5074e1fca29f90422954e7097d89dff497a0

---

## 📸 Screenshots

<<<<<<< HEAD
| Login Page         | Chatbot Page       |
|--------------------|--------------------|
| ![Login](/client/public/loginpage.png) | ![Chatbot](/client/public/chatpage.png) |
=======
| Login Page | Chatbot Page |
|------------|--------------|
COMING SOON
>>>>>>> 65fa5074e1fca29f90422954e7097d89dff497a0

---

## 🧩 Tech Stack

- **Frontend:** React, Tailwind CSS, Framer Motion
- **Backend:** **Node.js** (API middleware or Firebase Cloud Functions)
- **Authentication:** Firebase Auth (Email/Password + Google)
- **Database:** Firestore (for chat history, tickets, user profiles)
- **AI Integration:** OpenAI GPT (via secure Node backend)
- **Hosting:** Firebase Hosting

---

## ✨ Features

### 🔐 Login Page

- Email/password + Firebase Auth
- Loading state animations
- Error message feedback
- Auth persistence

### 🤖 Chatbot Page

<<<<<<< HEAD
- GPT-powered assistant trained on a custom knowledgebase to help with IT-related queries
=======
- GPT-powered assistant trained to help with IT-related queries
>>>>>>> 65fa5074e1fca29f90422954e7097d89dff497a0
- Firestore-backed real-time chat history
- Each message stored with user ID, timestamp, and session ID
- Automatic support ticket generation:
  - Extracts **Subject**, **Description**, and **Priority**
- Preview Ticket before confirming
- Save ticket to Firestore under `tickets/{chatId}` collection
- Persistent preview state across reloads
- Responsive mobile-first UI

---

## 📦 Backend (Node.js)

- Node.js handles OpenAI API calls securely (e.g., via Express)
- Prevents exposing the OpenAI API key in frontend
- Can be extended to:
  - CRUD operations for tickets (intelligently created based on conversation)
  - Preview Tickets (Edit/Update)
  - View conversations & agents assigned to tickets (email or id)
<<<<<<< HEAD
  - Intelligent responses based on custom knowledgebase
=======
  - Intelligent responses based on custom knowledgebase
>>>>>>> 65fa5074e1fca29f90422954e7097d89dff497a0
