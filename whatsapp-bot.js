const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store active sessions
const activeSessions = new Map();

// Session management routes
app.post('/api/session/create', (req, res) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    res.json({ sessionId });
});

const triggers = {
    'hello': 'Hi there! This is an automated response.',
    'help': 'Available commands:\n- hello\n- help\n- info',
    'info': 'This is a WhatsApp auto-reply bot using Baileys.',
};

async function createWhatsAppSession(sessionId) {
    const sessionPath = `auth_info_${sessionId}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        qrTimeout: 60000
    });

    const sessionInfo = { sock, state, saveCreds };
    activeSessions.set(sessionId, sessionInfo);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            io.to(`session_${sessionId}`).emit('qr', qr);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
                : true;
            
            io.to(`session_${sessionId}`).emit('connection-status', 'Disconnected');
            
            if (shouldReconnect) {
                createWhatsAppSession(sessionId);
            } else {
                activeSessions.delete(sessionId);
            }
        } else if (connection === 'open') {
            io.to(`session_${sessionId}`).emit('connection-status', 'Connected');
            io.to(`session_${sessionId}`).emit('authenticated');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const message of messages) {
            if (!message.key.fromMe && message.message) {
                const messageText = message.message?.conversation || 
                                  message.message?.extendedTextMessage?.text || '';
                
                const trigger = Object.keys(triggers).find(t => 
                    messageText.toLowerCase().includes(t.toLowerCase())
                );

                if (trigger) {
                    const response = triggers[trigger];
                    await sock.sendMessage(message.key.remoteJid, { text: response });
                }
            }
        }
    });

    return sessionInfo;
}

io.on('connection', (socket) => {
    socket.on('join-session', async (sessionId) => {
        socket.join(`session_${sessionId}`);
        
        let sessionInfo = activeSessions.get(sessionId);
        if (!sessionInfo) {
            sessionInfo = await createWhatsAppSession(sessionId);
        }
        
        socket.emit('triggers-update', triggers);
        socket.emit('connection-status', 'Initializing...');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});