const wppconnect = require('@wppconnect-team/wppconnect');

class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    // Initialize a new WhatsApp session
    async createSession(sessionId) {
        try {
            if (this.sessions.has(sessionId)) {
                console.log(`Session ${sessionId} already exists`);
                return this.sessions.get(sessionId);
            }

            console.log(`Creating new session: ${sessionId}`);
            const client = await wppconnect.create({
                session: sessionId,
                catchQR: (base64Qr, asciiQR) => {
                    console.log(`QR Code received for session ${sessionId}. Scan it with your WhatsApp app:`);
                    console.log(asciiQR);
                },
                statusFind: (statusSession, session) => {
                    console.log(`Status Session for ${sessionId}:`, statusSession);
                    console.log('Session name:', session);
                },
                logQR: true,
                puppeteerOptions: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            });

            await client.waitForLogin();
            console.log(`Client initialized successfully for session: ${sessionId}`);
            
            this.sessions.set(sessionId, client);
            return client;
        } catch (error) {
            console.error(`Error creating session ${sessionId}:`, error);
            throw error;
        }
    }

    // Get an existing session or create a new one
    async getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            return await this.createSession(sessionId);
        }
        return this.sessions.get(sessionId);
    }

    // Check if a session exists
    hasSession(sessionId) {
        return this.sessions.has(sessionId);
    }

    // Close a specific session
    async closeSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const client = this.sessions.get(sessionId);
            try {
                await client.close();
                this.sessions.delete(sessionId);
                console.log(`Session ${sessionId} closed successfully`);
                return true;
            } catch (error) {
                console.error(`Error closing session ${sessionId}:`, error);
                return false;
            }
        }
        return false;
    }

    // Get all active sessions
    getAllSessions() {
        return Array.from(this.sessions.keys());
    }

    // Close all sessions
    async closeAllSessions() {
        const sessionIds = this.getAllSessions();
        for (const sessionId of sessionIds) {
            await this.closeSession(sessionId);
        }
    }
}

module.exports = new SessionManager(); 