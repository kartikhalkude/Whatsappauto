const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const SessionManager = require('./sessionManager');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize the session manager with io
const manager = new SessionManager(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Create session event
    socket.on('create-session', async (sessionId) => {
        console.log('Creating session:', sessionId);
        
        // Register callback for QR code and status updates
        manager.registerQrCallback(sessionId, (data) => {
            // Check if it's a disconnection event
            if (data.disconnected) {
                // Get session info to send complete status
                const sessionInfo = manager.getSessionInfo(sessionId);
                
                // Enhance data with session info
                data.info = sessionInfo;
                
                console.log(`Sending disconnection event for ${sessionId}`);
            }
            
            // Send the data to the client
            socket.emit('qr-code', data);
        });
        
        // Create session
        const result = await manager.createSession(sessionId);
        
        if (result && result.error) {
            socket.emit('session-error', { error: result.error });
        }
    });
    
    // Disconnect event
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple health check endpoint
app.get('/api/status', (req, res) => {
    const activeSessions = manager.getAllSessions();
    res.json({ 
        status: 'Server is running', 
        activeSessions: activeSessions 
    });
});

// Get all active sessions
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = manager.getAllSessions();
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a session (API endpoint version)
app.post('/api/session/create', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Session ID is required' });
        }
        
        const result = await manager.createSession(sessionId);
        
        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }
        
        res.json({ success: true, message: 'Session created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Close a session
app.post('/api/session/:sessionId/close', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const result = await manager.closeSession(sessionId);
        
        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }
        
        res.json({ success: true, message: 'Session closed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get session QR code
app.get('/api/session/:sessionId/qr', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const qrCode = manager.getQrCode(sessionId);
        
        if (!qrCode) {
            return res.status(404).json({ success: false, error: 'QR code not found' });
        }
        
        res.json({ success: true, qrCode });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get session info
app.get('/api/session/:sessionId/info', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const info = manager.getSessionInfo(sessionId);
        
        if (!info) {
            return res.status(404).json({ success: false, error: 'Session info not found' });
        }
        
        res.json({ success: true, info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send a message
app.post('/api/send-message', async (req, res) => {
    try {
        const { sessionId, to, message } = req.body;
        
        if (!sessionId || !to || !message) {
            return res.status(400).json({ success: false, error: 'Session ID, recipient, and message are required' });
        }
        
        const result = await manager.sendMessage(sessionId, to, message);
        
        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }
        
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get contacts for a session
app.get('/api/contacts/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const result = await manager.getContacts(sessionId);
        
        if (result.error) {
            return res.status(400).json({ success: false, error: result.error });
        }
        
        res.json({ success: true, contacts: result.contacts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get auto-reply configuration
app.get('/api/auto-reply/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const config = manager.getAutoReply(sessionId);
    res.json({ success: true, config });
});

// Set auto-reply configuration
app.post('/api/auto-reply/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const config = req.body;
    
    try {
        const result = manager.setAutoReply(sessionId, config);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Closing all sessions...');
    await manager.closeAllSessions();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT. Closing all sessions...');
    await manager.closeAllSessions();
    process.exit(0);
});

// Start the server
server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log('Server is ready to handle WhatsApp sessions');
});