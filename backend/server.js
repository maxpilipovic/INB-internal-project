//DEV ONLY! Disable TLS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

//IMPORTS
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './config/firebase.js';
import chatRoutes from './routes/chat.js'

//Port
const PORT = 5000;

//Load environment variables
dotenv.config();

//Create app
const app = express();

//Middleware (CORS) and JSON parsing
app.use(cors());
app.use(express.json());

//Intalizes main routes /api/chat
app.use('/api/', chatRoutes);

//Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));


