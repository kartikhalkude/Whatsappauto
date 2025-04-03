const { create } = require('@wppconnect-team/wppconnect');

class SessionManager {
    constructor(io) {
        this.sessions = {};
        this.qrCodes = {};
        this.qrCallbacks = {};
        this.sessionInfo = {};
        this.autoReplyConfig = {};
        this.io = io;
        
        // Define status types for consistency
        this.CONNECTED_STATES = ['CONNECTED', 'PLUGGED', 'AUTHENTICATED', 'inChat', 'isLogged'];
        this.DISCONNECTED_STATES = ['DISCONNECTED', 'UNPLUGGED', 'CONFLICT', 'UNLAUNCHED', 'notLogged', 'browserClose'];
    }

    // Process QR code base64 string
    processQrCode(base64Qr) {
        // If the base64 string starts with 'data:image/png;base64,' or similar, remove it
        if (base64Qr.startsWith('data:image')) {
            return base64Qr.split(',')[1];
        }
        return base64Qr;
    }

    // Check if a status indicates a connected state
    isConnected(status) {
        if (!status) return false;
        return this.CONNECTED_STATES.includes(status.toUpperCase());
    }

    // Check if a status indicates a disconnected state
    isDisconnected(status) {
        if (!status) return true;
        return this.DISCONNECTED_STATES.includes(status.toUpperCase());
    }

    // Get auto-reply configuration for a session
    getAutoReply(sessionId) {
        if (!this.autoReplyConfig[sessionId]) {
            this.autoReplyConfig[sessionId] = {
                enabled: false,
                triggers: []
            };
        }
        return this.autoReplyConfig[sessionId];
    }

    // Add auto-reply configuration for a session
    setAutoReply(sessionId, config) {
        if (!this.autoReplyConfig[sessionId]) {
            this.autoReplyConfig[sessionId] = {
                enabled: false,
                triggers: []
            };
        }

        this.autoReplyConfig[sessionId] = {
            enabled: config.enabled || false,
            triggers: config.triggers || [],
            lastUpdated: new Date()
        };
        
        // Emit auto-reply status update
        if (this.io) {
            this.io.emit('auto-reply-status', {
                sessionId,
                config: this.autoReplyConfig[sessionId]
            });
        }
        
        return { success: true, config: this.autoReplyConfig[sessionId] };
    }

    // Add this method to handle incoming messages
    setupMessageHandler(client, sessionId) {
        // Remove any existing message handler for this session
        if (this._messageHandlers && this._messageHandlers[sessionId]) {
            client.removeAllListeners('message');
        }

        // Create a new message handler
        const messageHandler = async (message) => {
            // Skip messages sent by the client itself
            if (message.fromMe) return;

            // Emit received message to frontend
            this.io.emit('message', {
                sessionId,
                message: {
                    from: message.from,
                    body: message.body,
                    content: message.content
                }
            });

            // Check for auto-reply triggers
            const config = this.autoReplyConfig[sessionId];
            if (config && config.enabled && config.triggers) {
                const messageText = (message.body || message.content || '').toLowerCase();
                const matchingTrigger = config.triggers.find(trigger => 
                    messageText.includes(trigger.word.toLowerCase())
                );

                if (matchingTrigger) {
                    try {
                        await client.sendText(message.from, matchingTrigger.response);
                        this.io.emit('auto-reply-sent', {
                            sessionId,
                            to: message.from,
                            trigger: matchingTrigger.word
                        });
                    } catch (error) {
                        console.error(`Error sending auto-reply for session ${sessionId}:`, error);
                    }
                }
            }
        };

        // Store the handler reference
        if (!this._messageHandlers) {
            this._messageHandlers = {};
        }
        this._messageHandlers[sessionId] = messageHandler;

        // Set up the message handler using WPPConnect's method
        client.onMessage(messageHandler);
    }

    // Create a new WhatsApp session
    async createSession(sessionId) {
        if (this.sessions[sessionId]) {
            console.log(`Session ${sessionId} already exists`);
            return;
        }

        try {
            const client = await create({
                session: sessionId,
                catchQR: (base64Qr, asciiQR, attempts) => {
                    this.qrCodes[sessionId] = this.processQrCode(base64Qr);
                    
                    // Emit QR code to clients
                    this.io.emit('qr-code', {
                        sessionId,
                        base64Image: this.qrCodes[sessionId]
                    });
                },
                puppeteerOptions: {
                    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                },
                status: false,
                statusFind: (statusSession, session) => {
                    console.log('Status Session:', statusSession);
                    console.log('Session:', session);
                }
            });

            // Initialize session info
            this.sessionInfo[sessionId] = {
                status: 'STARTING',
                createdAt: new Date(),
                messageCount: 0
            };

            // Set up status change handler
            client.onStateChange((state) => {
                console.log(`State changed for session ${sessionId}:`, state);
                this.sessionInfo[sessionId].status = state;
                
                // Emit status update
                this.io.emit('qr-code', {
                    sessionId,
                    statusUpdate: true,
                    status: state
                });

                // If session is connected, emit a session-connected event
                if (this.CONNECTED_STATES.includes(state.toUpperCase())) {
                    this.io.emit('session-connected', {
                        sessionId,
                        status: state
                    });
                }
            });

            // Set up message handler
            this.setupMessageHandler(client, sessionId);

            // Store the session
            this.sessions[sessionId] = client;
            console.log(`Session ${sessionId} created`);

            return true;
        } catch (error) {
            console.error(`Error creating session ${sessionId}:`, error);
            throw error;
        }
    }

    // Update session info with user data
    async updateSessionInfo(sessionId) {
        if (!this.sessions[sessionId]) return;

        try {
            const client = this.sessions[sessionId];
            
            // Get connected user info
            const info = await client.getHostDevice();
            
            // Update session info with minimal data
            if (this.sessionInfo[sessionId]) {
                this.sessionInfo[sessionId].user = info.pushname || 'Unknown';
            }
        } catch (error) {
            console.error('Error updating session info:', error);
        }
    }

    // Get session info
    getSessionInfo(sessionId) {
        return this.sessionInfo[sessionId] || null;
    }

    // Register QR code callback
    registerQrCallback(sessionId, callback) {
        if (!this.qrCallbacks[sessionId]) {
            this.qrCallbacks[sessionId] = [];
        }
        this.qrCallbacks[sessionId].push(callback);
    }

    // Unregister QR code callback
    unregisterQrCallback(sessionId, callback) {
        if (this.qrCallbacks[sessionId]) {
            this.qrCallbacks[sessionId] = this.qrCallbacks[sessionId].filter(cb => cb !== callback);
        }
    }

    // Get stored QR code
    getQrCode(sessionId) {
        return this.qrCodes[sessionId] || null;
    }

    // Send a message to a number
    async sendMessage(sessionId, to, message) {
        if (!this.sessions[sessionId]) {
            return { error: 'Session not found' };
        }

        try {
            // Format number
            const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
            
            // Send message
            const result = await this.sessions[sessionId].sendText(formattedNumber, message);
            
            // Increment message count
            if (this.sessionInfo[sessionId]) {
                this.sessionInfo[sessionId].messageCount = (this.sessionInfo[sessionId].messageCount || 0) + 1;
                this.sessionInfo[sessionId].lastActive = new Date();
            }
            
            return { success: true, result };
        } catch (error) {
            console.error('Error sending message:', error);
            return { error: error.message };
        }
    }

    // Get all contacts
    async getContacts(sessionId) {
        if (!this.sessions[sessionId]) {
            return { error: 'Session not found' };
        }

        try {
            // Get contacts
            const contacts = await this.sessions[sessionId].getAllContacts();
            
            // Update last active
            if (this.sessionInfo[sessionId]) {
                this.sessionInfo[sessionId].lastActive = new Date();
            }
            
            return { success: true, contacts };
        } catch (error) {
            console.error('Error getting contacts:', error);
            return { error: error.message };
        }
    }

    // Close a session
    async closeSession(sessionId) {
        if (!this.sessions[sessionId]) {
            return { error: 'Session not found' };
        }

        try {
            // Close the session
            await this.sessions[sessionId].close();
            
            // Clean up
            delete this.sessions[sessionId];
            delete this.qrCodes[sessionId];
            delete this.qrCallbacks[sessionId];
            delete this.sessionInfo[sessionId];
            
            return { success: true, message: 'Session closed' };
        } catch (error) {
            console.error('Error closing session:', error);
            return { error: error.message };
        }
    }

    // Get all active sessions
    getAllSessions() {
        return Object.keys(this.sessions);
    }
}

// Export the class instead of an instance
module.exports = SessionManager; 