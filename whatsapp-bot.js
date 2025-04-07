const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Define triggers for auto-replies
const triggers = {
    'hello': 'Hi there! This is an automated response.',
    'help': 'Available commands:\n- hello\n- help\n- info',
    'info': 'This is a WhatsApp auto-reply bot using Baileys.',
};

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store active sessions with validation
const activeSessions = new Map();
const MAX_SESSIONS_PER_IP = 3;
const ipSessionCount = new Map();

// Secure session creation with IP tracking
app.post('/api/session/create', (req, res) => {
    const clientIp = req.ip;
    const currentCount = ipSessionCount.get(clientIp) || 0;
    
    if (currentCount >= MAX_SESSIONS_PER_IP) {
        return res.status(429).json({ error: 'Maximum session limit reached' });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    ipSessionCount.set(clientIp, currentCount + 1);
    res.json({ sessionId });
});

// Session cleanup on disconnect
function cleanupSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
        activeSessions.delete(sessionId);
        // Clean up auth files
        const sessionPath = `auth_info_${sessionId}`;
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    }
}

// Secure WebSocket connection
io.use((socket, next) => {
    const clientIp = socket.handshake.address;
    if (ipSessionCount.get(clientIp) > MAX_SESSIONS_PER_IP) {
        return next(new Error('Maximum session limit reached'));
    }
    next();
});

async function createWhatsAppSession(sessionId) {
    try {
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
    } catch (error) {
        console.error('Failed to create WhatsApp session:', error);
    }
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

// Add cleanup on process exit
process.on('SIGINT', () => {
    activeSessions.forEach((session, sessionId) => {
        cleanupSession(sessionId);
    });
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});