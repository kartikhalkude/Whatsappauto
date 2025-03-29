const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const sessionManager = require('./sessionManager');
const app = express();
const port = 3000;

app.use(express.json());

// Simple health check endpoint
app.get('/', (req, res) => {
    const activeSessions = sessionManager.getAllSessions();
    res.json({ 
        status: 'Server is running', 
        activeSessions: activeSessions 
    });
});

// Create a new session
app.post('/session/create', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const client = await sessionManager.createSession(sessionId);
        res.json({ 
            success: true, 
            message: `Session ${sessionId} created successfully` 
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create session',
            details: error.message 
        });
    }
});

// Close a session
app.post('/session/close', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const result = await sessionManager.closeSession(sessionId);
        if (result) {
            res.json({ 
                success: true, 
                message: `Session ${sessionId} closed successfully` 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: `Session ${sessionId} not found` 
            });
        }
    } catch (error) {
        console.error('Error closing session:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to close session',
            details: error.message 
        });
    }
});

// Send a message using a specific session
app.post('/send-message', async (req, res) => {
    try {
        const { sessionId, phone, message } = req.body;

        if (!sessionId || !phone || !message) {
            return res.status(400).json({ 
                error: 'Session ID, phone number, and message are required' 
            });
        }

        const client = await sessionManager.getSession(sessionId);
        
        // Format the phone number
        let formattedPhone = phone.toString().replace(/[^\d]/g, '');
        if (!formattedPhone.endsWith('@c.us')) {
            formattedPhone = `${formattedPhone}@c.us`;
        }

        console.log(`[Session: ${sessionId}] Sending message to: ${formattedPhone}`);

        // Check if the number exists on WhatsApp
        const isRegistered = await client.checkNumberStatus(formattedPhone);
        if (!isRegistered.numberExists) {
            return res.status(404).json({ error: 'This number is not registered on WhatsApp' });
        }

        // Send the message
        const result = await client.sendText(formattedPhone, message);
        console.log(`[Session: ${sessionId}] Message sent successfully:`, result);
        
        res.json({ 
            success: true, 
            message: 'Message sent successfully',
            details: result 
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message',
            details: error.message 
        });
    }
});

// Get contacts for a specific session
app.get('/contacts/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const client = await sessionManager.getSession(sessionId);
        console.log(`[Session: ${sessionId}] Fetching contacts...`);
        
        const contacts = await client.getAllContacts();
        console.log(`[Session: ${sessionId}] Retrieved ${contacts.length} contacts`);
        
        res.json({ 
            success: true, 
            sessionId,
            contactCount: contacts.length,
            contacts: contacts.map(contact => ({
                id: contact.id,
                name: contact.name,
                pushname: contact.pushname,
                isGroup: contact.isGroup,
                isWAContact: contact.isWAContact
            }))
        });

    } catch (error) {
        console.error('Error getting contacts:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get contacts',
            details: error.message 
        });
    }
});

// Get all active sessions
app.get('/sessions', (req, res) => {
    const sessions = sessionManager.getAllSessions();
    res.json({ 
        success: true, 
        sessions 
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Closing all sessions...');
    await sessionManager.closeAllSessions();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT. Closing all sessions...');
    await sessionManager.closeAllSessions();
    process.exit(0);
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log('Server is ready to handle WhatsApp sessions');
});