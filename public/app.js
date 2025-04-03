// Initialize Socket.IO
const socket = io();

// DOM elements
const sessionIdInput = document.getElementById('sessionIdInput');
const createSessionBtn = document.getElementById('createSessionBtn');
const quickCreateBtn = document.getElementById('quickCreateBtn');
const sessionsList = document.getElementById('sessionsList');
const qrContainer = document.getElementById('qrContainer');
const sessionSelect = document.getElementById('sessionSelect');
const bulkSessionSelect = document.getElementById('bulkSessionSelect');
const sendMessageForm = document.getElementById('sendMessageForm');
const bulkMessageForm = document.getElementById('bulkMessageForm');
const phoneNumberInput = document.getElementById('phoneNumber');
const messageTextInput = document.getElementById('messageText');
const bulkPhoneNumbers = document.getElementById('bulkPhoneNumbers');
const bulkMessageText = document.getElementById('bulkMessageText');
const bulkDelay = document.getElementById('bulkDelay');
const bulkProgressCard = document.getElementById('bulkProgressCard');
const bulkProgressBar = document.getElementById('bulkProgressBar');
const bulkSent = document.getElementById('bulkSent');
const bulkTotal = document.getElementById('bulkTotal');
const bulkProgressLog = document.getElementById('bulkProgressLog');
const recentMessagesList = document.getElementById('recentMessagesList');
const serverStatus = document.getElementById('serverStatus');
const activeSessions = document.getElementById('activeSessions');
const messagesSent = document.getElementById('messagesSent');
const serverUptime = document.getElementById('serverUptime');
const sessionsDetailsList = document.getElementById('sessionsDetailsList');
const statusToast = document.getElementById('statusToast');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');
const toastTime = document.getElementById('toastTime');
const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
const qrImage = document.getElementById('qrImage');
const sessionDetailModal = new bootstrap.Modal(document.getElementById('sessionDetailModal'));
const sessionDetailContent = document.getElementById('sessionDetailContent');
const autoReplyToggle = document.getElementById('autoReplyToggle');
const autoReplyMessage = document.getElementById('autoReplyMessage');
const autoReplyStatus = document.getElementById('autoReplyStatus');
const autoReplySessionSelect = document.getElementById('autoReplySessionSelect');
const activeAutoReplies = document.getElementById('activeAutoReplies');

// Toast instance
const toast = new bootstrap.Toast(statusToast);

// Stats
let messagesCounter = 0;
let serverStartTime = new Date();

// Current active session
let currentSession = null;

// Recent messages array
const recentMessages = [];
const MAX_RECENT_MESSAGES = 10;

// Add these new functions for auto-reply functionality
let autoReplyEnabled = false;

// Add trigger rule template functionality
const addTriggerBtn = document.getElementById('addTriggerBtn');
const triggerRulesList = document.getElementById('triggerRulesList');
const triggerRuleTemplate = document.getElementById('triggerRuleTemplate');

// Add event listener for adding new trigger rules
if (addTriggerBtn) {
    addTriggerBtn.addEventListener('click', addNewTriggerRule);
}

// Add event listener for saving auto-reply configuration
const saveAutoReplyBtn = document.getElementById('saveAutoReplyBtn');
if (saveAutoReplyBtn) {
    saveAutoReplyBtn.addEventListener('click', saveAutoReplyConfig);
}

// Function to add new trigger rule
function addNewTriggerRule() {
    const newRule = triggerRuleTemplate.content.cloneNode(true);
    
    // Add delete functionality
    const deleteBtn = newRule.querySelector('.delete-trigger');
    deleteBtn.addEventListener('click', function() {
        this.closest('.trigger-rule').remove();
    });
    
    triggerRulesList.appendChild(newRule);
}

// Save auto-reply configuration
async function saveAutoReplyConfig() {
    const sessionId = autoReplySessionSelect.value;
    if (!sessionId) {
        showToast('Error', 'Please select a session', 'error');
        return;
    }

    // Collect all trigger rules
    const triggers = [];
    const triggerRules = triggerRulesList.querySelectorAll('.trigger-rule');
    
    triggerRules.forEach(rule => {
        const triggerWord = rule.querySelector('.trigger-input').value.trim();
        const response = rule.querySelector('.response-input').value.trim();
        
        if (triggerWord && response) {
            triggers.push({
                word: triggerWord,
                response: response
            });
        }
    });

    if (autoReplyToggle.checked && triggers.length === 0) {
        showToast('Error', 'Please add at least one trigger rule when auto-reply is enabled', 'error');
        return;
    }

    const config = {
        enabled: autoReplyToggle.checked,
        triggers: triggers
    };

    try {
        const response = await fetch(`/api/auto-reply/${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();
        if (data.success) {
            showToast('Success', 'Auto-reply configuration saved successfully', 'success');
            updateAutoReplyStatus(
                config.enabled ? 'Auto-reply is active' : 'Auto-reply is inactive',
                config.enabled ? 'success' : 'warning'
            );
            updateActiveAutoReplies();
        } else {
            throw new Error(data.error || 'Failed to save configuration');
        }
    } catch (error) {
        console.error('Error saving auto-reply config:', error);
        showToast('Error', 'Failed to save auto-reply configuration', 'error');
    }
}

// Update auto-reply status display
function updateAutoReplyStatus(message, type = 'secondary') {
    if (autoReplyStatus) {
        autoReplyStatus.className = `alert alert-${type} mb-0`;
        autoReplyStatus.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-circle'} me-2"></i>${message}
        `;
    }
}

// Initialize the app
async function init() {
    // Load existing sessions
    await loadSessions();
    
    // Update stats
    updateStats();
    
    // Start uptime counter
    setInterval(updateUptime, 1000);
    
    // Event listeners
    createSessionBtn.addEventListener('click', createSession);
    if (quickCreateBtn) {
        quickCreateBtn.addEventListener('click', quickCreateSession);
    }
    sendMessageForm.addEventListener('submit', sendMessage);
    bulkMessageForm.addEventListener('submit', sendBulkMessages);
    
    // Socket event listeners
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        updateServerStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        updateServerStatus(false);
    });
    
    socket.on('qr-code', handleQrCode);
    
    socket.on('session-error', (data) => {
        showToast('Error', `Session error: ${data.error}`, 'error');
    });
    
    socket.on('message', handleIncomingMessage);

    // Handle session connected event
    socket.on('session-connected', (data) => {
        console.log('Session connected:', data.sessionId);
        showToast('Success', `Session ${data.sessionId} connected successfully!`, 'success');
        
        // Refresh the sessions list
        loadSessions();
        
        // Update stats
        updateStats();
        
        // If we're in the sessions tab, update the QR container to show connected state
        if (document.getElementById('sessions-tab').classList.contains('active')) {
            if (qrContainer && currentSession === data.sessionId) {
                qrContainer.innerHTML = `
                    <div class="card-body">
                        <div class="text-center p-4">
                            <div class="session-status-card">
                                <div class="status-icon mb-3">
                                    <i class="fas fa-check-circle fa-3x text-success"></i>
                                </div>
                                <h5 class="mb-3">WhatsApp Connected</h5>
                                <div class="session-info mb-3">
                                    <span class="badge bg-success">
                                        <i class="fas fa-plug me-1"></i>Session ${data.sessionId}
                                    </span>
                                </div>
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('send-tab').click()">
                                        <i class="fas fa-paper-plane me-1"></i>Send Messages
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="viewSessionDetail('${data.sessionId}')">
                                        <i class="fas fa-info-circle me-1"></i>Session Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    });

    // Update active auto-replies
    await updateActiveAutoReplies();
}

// Update server status
function updateServerStatus(isOnline) {
    if (serverStatus) {
        serverStatus.textContent = isOnline ? 'Online' : 'Offline';
        serverStatus.parentElement.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
    }
}

// Update stats
function updateStats() {
    if (activeSessions) {
        fetch('/api/sessions')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    activeSessions.textContent = data.sessions.length;
                }
            })
            .catch(error => console.error('Error fetching sessions:', error));
    }
    
    if (messagesSent) {
        messagesSent.textContent = messagesCounter;
    }
    
    updateUptime();
}

// Update uptime
function updateUptime() {
    if (serverUptime) {
        const now = new Date();
        const diff = Math.floor((now - serverStartTime) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        serverUptime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Quick create session with random ID
function quickCreateSession() {
    const randomId = 'session_' + Math.random().toString(36).substring(2, 10);
    sessionIdInput.value = randomId;
    createSession();
}

// Create a new WhatsApp session
async function createSession() {
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) {
        showToast('Error', 'Please enter a session ID', 'error');
        return;
    }

    try {
        // First check if session exists and its status
        const response = await fetch(`/api/session/${sessionId}/info`);
        const data = await response.json();
        
        if (data.success && data.info) {
            const status = data.info.status;
            
            if (isSessionConnected(status)) {
                // Set current session
                currentSession = sessionId;
                
                // Update QR container to show connected state immediately
                if (qrContainer) {
                    qrContainer.innerHTML = `
                        <div class="card-body">
                            <div class="text-center p-4">
                                <div class="session-status-card">
                                    <div class="status-icon mb-3">
                                        <i class="fas fa-check-circle fa-3x text-success"></i>
                                    </div>
                                    <h5 class="mb-3">WhatsApp Connected</h5>
                                    <div class="session-info mb-3">
                                        <span class="badge bg-success">
                                            <i class="fas fa-plug me-1"></i>Session ${sessionId}
                                        </span>
                                    </div>
                                    <div class="d-flex justify-content-center gap-2">
                                        <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('send-tab').click()">
                                            <i class="fas fa-paper-plane me-1"></i>Send Messages
                                        </button>
                                        <button class="btn btn-sm btn-outline-secondary" onclick="viewSessionDetail('${sessionId}')">
                                            <i class="fas fa-info-circle me-1"></i>Session Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Show toast and refresh sessions list
                showToast('Info', `Session ${sessionId} is already connected`, 'success');
                await loadSessions();
                
                // Switch to sessions tab
                document.getElementById('sessions-tab').click();
                
                // Update stats
                updateStats();
                return;
            }

            // If session exists but not connected, check if it's in a transitional state
            if (data.info.status === 'STARTING' || data.info.status === 'CONNECTING') {
                showToast('Info', `Session ${sessionId} is already being initialized. Please wait...`, 'info');
                return;
            }
        }
        
        // If not connected or session doesn't exist, proceed with session creation
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div class="card-body">
                    <div class="text-center p-5">
                        <h4>Creating session ${sessionId}...</h4>
                        <div class="spinner-border text-success mt-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mt-3">Please wait while we initialize your WhatsApp session</p>
                    </div>
                </div>
            `;
            qrContainer.style.display = 'block';
        }
        
        // Emit create-session event
        socket.emit('create-session', sessionId);
        
        // Set current session
        currentSession = sessionId;
        
        showToast('Info', `Creating session ${sessionId}. Please wait...`, 'info');
        
        // Switch to sessions tab to show QR code
        document.getElementById('sessions-tab').click();
        
    } catch (error) {
        console.error('Error checking session status:', error);
        showToast('Error', 'Failed to check session status', 'error');
    }
}

// Handle QR code received from server
async function handleQrCode(data) {
    console.log('QR code or status update received:', data);
    
    if (!qrContainer) return;
    
    if (data.disconnected) {
        // Handle disconnection event
        showToast('Warning', `Session ${data.sessionId} disconnected`, 'warning');
        updateSessionStatus(data.sessionId, 'DISCONNECTED');
        
        if (currentSession === data.sessionId) {
            qrContainer.innerHTML = `
                <div class="card-body">
                    <div class="text-center p-5 fade-in">
                        <div class="mb-4">
                            <i class="fas fa-exclamation-circle fa-4x text-warning"></i>
                        </div>
                        <h4>Session ${data.sessionId} disconnected</h4>
                        <div class="alert alert-warning mt-3">
                            <i class="fas fa-exclamation-triangle me-2"></i> WhatsApp disconnected
                        </div>
                        <div class="mt-4">
                            <button class="btn btn-primary" onclick="reconnectSession('${data.sessionId}')">
                                <i class="fas fa-redo-alt me-2"></i>Reconnect Session
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (data.info) {
            updateSessionInfo(data.sessionId, data.info);
        }
        
        loadSessions();
        return;
    }
    
    if (data.statusUpdate) {
        console.log(`Status update for ${data.sessionId}:`, data.status);
        updateSessionStatus(data.sessionId, data.status);
        
        if (isSessionConnected(data.status) && currentSession === data.sessionId) {
            // Update QR container immediately for connected state
            if (qrContainer) {
                qrContainer.innerHTML = `
                    <div class="card-body">
                        <div class="text-center p-4">
                            <div class="session-status-card">
                                <div class="status-icon mb-3">
                                    <i class="fas fa-check-circle fa-3x text-success"></i>
                                </div>
                                <h5 class="mb-3">WhatsApp Connected</h5>
                                <div class="session-info mb-3">
                                    <span class="badge bg-success">
                                        <i class="fas fa-plug me-1"></i>Session ${data.sessionId}
                                    </span>
                                </div>
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('send-tab').click()">
                                        <i class="fas fa-paper-plane me-1"></i>Send Messages
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="viewSessionDetail('${data.sessionId}')">
                                        <i class="fas fa-info-circle me-1"></i>Session Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            loadSessions(); // Refresh the sessions list
        }
        return;
    }
    
    try {
        // Check session status before showing QR code
        const response = await fetch(`/api/session/${data.sessionId}/info`);
        const sessionData = await response.json();
        
        if (sessionData.success && sessionData.info && isSessionConnected(sessionData.info.status)) {
            // Update QR container immediately for connected state
            if (qrContainer) {
                qrContainer.innerHTML = `
                    <div class="card-body">
                        <div class="text-center p-4">
                            <div class="session-status-card">
                                <div class="status-icon mb-3">
                                    <i class="fas fa-check-circle fa-3x text-success"></i>
                                </div>
                                <h5 class="mb-3">WhatsApp Connected</h5>
                                <div class="session-info mb-3">
                                    <span class="badge bg-success">
                                        <i class="fas fa-plug me-1"></i>Session ${data.sessionId}
                                    </span>
                                </div>
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('send-tab').click()">
                                        <i class="fas fa-paper-plane me-1"></i>Send Messages
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="viewSessionDetail('${data.sessionId}')">
                                        <i class="fas fa-info-circle me-1"></i>Session Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            loadSessions();
        } else if (data.base64Image) {
            // Only show QR if session is not connected
            showQRCode(data.base64Image, data.sessionId);
        }
    } catch (error) {
        console.error('Error checking session status:', error);
        // If error checking status, show QR code as fallback
        if (data.base64Image) {
            showQRCode(data.base64Image, data.sessionId);
        }
    }
}

// Helper function to show QR code
function showQRCode(base64Image, sessionId) {
    // Ensure base64 string is properly formatted
    let base64Data = base64Image;
    if (!base64Data.startsWith('data:image')) {
        base64Data = `data:image/png;base64,${base64Data}`;
    }
    
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="card-body">
                <div class="text-center fade-in">
                    <h4>Scan this QR code with WhatsApp</h4>
                    <div class="qr-code-wrapper my-4">
                        <img src="${base64Data}" alt="WhatsApp QR Code" style="max-width: 300px;">
                    </div>
                    <div class="qr-status">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i> Open WhatsApp on your phone and scan this code
                        </div>
                        <div class="small text-muted mt-2">
                            The QR code expires in 45 seconds. If expired, click the refresh button below.
                        </div>
                        <button class="btn btn-outline-primary mt-3" onclick="createSession()">
                            <i class="fas fa-sync-alt me-2"></i>Refresh QR Code
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Update session info in the UI
function updateSessionInfo(sessionId, info) {
    // Update session message counter if available
    const messageCounter = document.getElementById(`sessionMessages_${sessionId}`);
    if (messageCounter && info.messageCount !== undefined) {
        messageCounter.textContent = info.messageCount;
    }
    
    // Any other session-specific information that needs to be updated
    // can be added here
}

// Load all active sessions
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();
        
        if (data.success) {
            // Remove duplicate sessions and store unique sessions
            const uniqueSessions = Array.from(new Set(data.sessions));
            
            // Clear any existing sessions from the UI first
            if (sessionsList) {
                sessionsList.innerHTML = '';
            }
            
            // Update sessions list and selects first
            updateSessionsList(uniqueSessions);
            updateSessionSelects(uniqueSessions);
            updateSessionsDetails(uniqueSessions);
            
            // Check if any session is connected and update QR container
            for (const sessionId of uniqueSessions) {
                try {
                    const sessionResponse = await fetch(`/api/session/${sessionId}/info`);
                    const sessionData = await sessionResponse.json();
                    
                    if (sessionData.success && sessionData.info) {
                        const status = sessionData.info.status;
                        
                        // Update session status in UI
                        updateSessionStatus(sessionId, status);
                        
                        // If this is the current session and it's connected, update QR container
                        if (currentSession === sessionId && isSessionConnected(status)) {
                            updateQRContainerForConnectedSession(sessionId);
                        }
                    }
                } catch (error) {
                    console.error(`Error checking session ${sessionId} status:`, error);
                }
            }
        } else {
            showToast('Error', 'Failed to load sessions', 'error');
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showToast('Error', 'Failed to load sessions', 'error');
    }
}

// Update the sessions list
function updateSessionsList(sessions) {
    if (!sessionsList) return;
    
    // Clear existing sessions
    sessionsList.innerHTML = '';
    
    if (sessions.length === 0) {
        sessionsList.innerHTML = `
            <div class="text-center p-4 text-muted">
                <i class="fas fa-info-circle mb-2 fa-2x"></i>
                <p>No active sessions. Create a new session to begin.</p>
            </div>
        `;
        return;
    }
    
    // Create a map to track unique sessions
    const uniqueSessionsMap = new Map();
    
    // Process sessions and keep only the latest entry for each session ID
    sessions.forEach(sessionId => {
        if (!uniqueSessionsMap.has(sessionId)) {
            uniqueSessionsMap.set(sessionId, true);
        }
    });
    
    // Get session status for each unique session
    Promise.all(Array.from(uniqueSessionsMap.keys()).map(sessionId => 
        fetch(`/api/session/${sessionId}/info`)
            .then(res => res.json())
            .then(data => ({ 
                sessionId, 
                info: data.success ? data.info : null 
            }))
            .catch(() => ({ sessionId, info: null }))
    )).then(sessionsWithInfo => {
        sessionsWithInfo.forEach(({ sessionId, info }) => {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center session-item fade-in';
            
            const status = info && info.status ? info.status : 'Unknown';
            const isConnected = isSessionConnected(status);
            const iconClass = isConnected ? 'text-success' : 'text-danger';
            const statusText = isConnected ? 'Connected' : 'Disconnected';
            
            item.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="session-icon me-3">
                        <i class="fas fa-mobile-alt"></i>
                    </div>
                    <div>
                        <h6 class="mb-0">${sessionId}</h6>
                        <span class="text-muted small">
                            <i class="fas fa-circle ${iconClass} me-1"></i> 
                            ${statusText}
                        </span>
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary view-session-btn" data-session="${sessionId}" title="View QR Code">
                        <i class="fas fa-qrcode"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary view-detail-btn" data-session="${sessionId}" title="View Details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-danger close-session-btn" data-session="${sessionId}" title="Close Session">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            sessionsList.appendChild(item);
        });
        
        // Add event listeners
        document.querySelectorAll('.view-session-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                viewSessionQR(btn.dataset.session);
            });
        });
        
        document.querySelectorAll('.close-session-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                closeSession(btn.dataset.session);
            });
        });
        
        document.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                viewSessionDetail(btn.dataset.session);
            });
        });
    });
}

// Helper function to update QR container for connected session
function updateQRContainerForConnectedSession(sessionId) {
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="card-body">
                <div class="text-center p-4">
                    <div class="session-status-card">
                        <div class="status-icon mb-3">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                        </div>
                        <h5 class="mb-3">WhatsApp Connected</h5>
                        <div class="session-info mb-3">
                            <span class="badge bg-success">
                                <i class="fas fa-plug me-1"></i>Session ${sessionId}
                            </span>
                        </div>
                        <div class="d-flex justify-content-center gap-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('send-tab').click()">
                                <i class="fas fa-paper-plane me-1"></i>Send Messages
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="viewSessionDetail('${sessionId}')">
                                <i class="fas fa-info-circle me-1"></i>Session Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Update session details in status tab
function updateSessionsDetails(sessions) {
    if (!sessionsDetailsList) return;
    
    sessionsDetailsList.innerHTML = '';
    
    if (sessions.length === 0) {
        sessionsDetailsList.innerHTML = `
            <div class="text-center p-4 text-muted">
                <i class="fas fa-info-circle mb-2 fa-2x"></i>
                <p>No active sessions.</p>
            </div>
        `;
        return;
    }
    
    const table = document.createElement('div');
    table.className = 'sessions-details-table';
    
    // Add table header
    const header = document.createElement('div');
    header.className = 'sessions-details-header';
    header.innerHTML = `
        <div class="header-cell" style="width: 25%">Session ID</div>
        <div class="header-cell" style="width: 25%">Status</div>
        <div class="header-cell" style="width: 25%">Created</div>
        <div class="header-cell" style="width: 25%">Actions</div>
    `;
    table.appendChild(header);
    
    // Get session status for each session
    Promise.all(sessions.map(sessionId => 
        fetch(`/api/session/${sessionId}/info`)
            .then(res => res.json())
            .then(data => ({ 
                sessionId, 
                info: data.success ? data.info : null 
            }))
            .catch(() => ({ sessionId, info: null }))
    )).then(sessionsWithInfo => {
        sessionsWithInfo.forEach(({ sessionId, info }) => {
            const status = info && info.status ? info.status : 'Unknown';
            const isConnected = isSessionConnected(status);
            const statusClass = isConnected ? 'online' : 'offline';
            const statusText = isConnected ? 'Connected' : 'Disconnected';
            const createdTime = info && info.createdAt 
                ? new Date(info.createdAt).toLocaleString()
                : 'N/A';
            
            const row = document.createElement('div');
            row.className = 'sessions-details-row fade-in';
            
            row.innerHTML = `
                <div class="cell session-cell" style="width: 25%">
                    <div class="session-info">
                        <div class="session-icon">
                            <i class="fas fa-mobile-alt"></i>
                        </div>
                        <span class="session-name">${sessionId}</span>
                    </div>
                </div>
                <div class="cell status-cell" style="width: 25%">
                    <div class="status-badge ${statusClass}">
                        <i class="fas fa-circle me-1"></i>
                        <span>${statusText}</span>
                    </div>
                </div>
                <div class="cell created-cell" style="width: 25%">
                    <div class="created-info">
                        <i class="fas fa-calendar-alt me-2"></i>
                        <span>${createdTime}</span>
                    </div>
                </div>
                <div class="cell actions-cell" style="width: 25%">
                    <div class="actions-buttons">
                        ${!isConnected ? `
                            <button class="btn btn-sm btn-primary me-2" onclick="reconnectSession('${sessionId}')">
                                <i class="fas fa-redo-alt me-1"></i>Reconnect
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" onclick="closeSession('${sessionId}')">
                            <i class="fas fa-times me-1"></i>Close
                        </button>
                    </div>
                </div>
            `;
            
            table.appendChild(row);
        });
        
        sessionsDetailsList.appendChild(table);
        
        // Add CSS styles for the sessions details table
        const style = document.createElement('style');
        style.textContent = `
            .sessions-details-table {
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            
            .sessions-details-header {
                display: flex;
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
                padding: 12px 16px;
                font-weight: 600;
                color: #495057;
            }
            
            .sessions-details-row {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #e9ecef;
                transition: background-color 0.2s;
            }
            
            .sessions-details-row:last-child {
                border-bottom: none;
            }
            
            .sessions-details-row:hover {
                background-color: #f8f9fa;
            }
            
            .header-cell {
                padding: 0 8px;
                font-size: 0.9rem;
            }
            
            .cell {
                padding: 0 8px;
            }
            
            .session-info {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .session-icon {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background-color: #e3f2fd;
                color: #1976d2;
            }
            
            .session-name {
                font-weight: 500;
                color: #1a1a1a;
                font-size: 0.9rem;
            }
            
            .status-badge {
                display: inline-flex;
                align-items: center;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.85rem;
            }
            
            .status-badge.online {
                background-color: #e8f5e9;
                color: #2e7d32;
            }
            
            .status-badge.offline {
                background-color: #ffebee;
                color: #c62828;
            }
            
            .created-info {
                display: flex;
                align-items: center;
                color: #1a1a1a;
                font-size: 0.9rem;
            }
            
            .actions-buttons {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .fade-in {
                animation: fadeIn 0.3s ease-in-out;
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    });
}

// Update session selects
function updateSessionSelects(sessions) {
    // Update main session select
    if (sessionSelect) {
        updateSelect(sessionSelect, sessions);
    }
    
    // Update bulk session select
    if (bulkSessionSelect) {
        updateSelect(bulkSessionSelect, sessions);
    }
    
    // Update auto-reply session select
    if (autoReplySessionSelect) {
        updateSelect(autoReplySessionSelect, sessions);
        
        // Add change event listener
        autoReplySessionSelect.addEventListener('change', loadAutoReplyConfig);
    }
}

// Helper function to update select elements
function updateSelect(selectElement, sessions) {
    selectElement.innerHTML = '';
    
    if (sessions.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No active sessions';
        selectElement.appendChild(option);
        selectElement.disabled = true;
    } else {
        selectElement.disabled = false;
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a session';
        selectElement.appendChild(defaultOption);
        
        sessions.forEach(sessionId => {
            const option = document.createElement('option');
            option.value = sessionId;
            option.textContent = sessionId;
            selectElement.appendChild(option);
        });
    }
}

// Load auto-reply configuration for selected session
async function loadAutoReplyConfig() {
    const sessionId = autoReplySessionSelect.value;
    
    if (!sessionId) {
        updateAutoReplyStatus('Select a session to configure auto-reply', 'secondary');
        autoReplyToggle.checked = false;
        triggerRulesList.innerHTML = '';
        autoReplyToggle.disabled = true;
        addTriggerBtn.disabled = true;
        return;
    }
    
    try {
        const response = await fetch(`/api/auto-reply/${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
            const config = data.config;
            autoReplyToggle.checked = config.enabled;
            autoReplyToggle.disabled = false;
            addTriggerBtn.disabled = false;
            
            // Clear existing rules
            triggerRulesList.innerHTML = '';
            
            // Add saved trigger rules
            if (config.triggers && Array.isArray(config.triggers)) {
                config.triggers.forEach(trigger => {
                    const newRule = triggerRuleTemplate.content.cloneNode(true);
                    const triggerInput = newRule.querySelector('.trigger-input');
                    const responseInput = newRule.querySelector('.response-input');
                    
                    triggerInput.value = trigger.word;
                    responseInput.value = trigger.response;
                    
                    // Add delete functionality
                    const deleteBtn = newRule.querySelector('.delete-trigger');
                    deleteBtn.addEventListener('click', function() {
                        this.closest('.trigger-rule').remove();
                    });
                    
                    triggerRulesList.appendChild(newRule);
                });
            }
            
            updateAutoReplyStatus(
                config.enabled ? 'Auto-reply is active' : 'Auto-reply is inactive',
                config.enabled ? 'success' : 'warning'
            );
        }
    } catch (error) {
        console.error('Error loading auto-reply config:', error);
        showToast('Error', 'Failed to load auto-reply configuration', 'error');
    }
}

// Update active auto-replies when socket events are received
socket.on('auto-reply-status', (data) => {
    if (data.sessionId === autoReplySessionSelect.value) {
        autoReplyToggle.checked = data.config.enabled;
        autoReplyToggle.disabled = false;
        addTriggerBtn.disabled = false;
        updateAutoReplyStatus(
            data.config.enabled ? 'Auto-reply is active' : 'Auto-reply is inactive',
            data.config.enabled ? 'success' : 'warning'
        );
    }
    updateActiveAutoReplies();
});

// Update active auto-replies when socket events are received
socket.on('auto-reply-sent', (data) => {
    showToast(`Auto-reply sent to ${data.to}`, 'info');
    updateRecentMessages(data.sessionId);
});

// Update active auto-replies list
async function updateActiveAutoReplies() {
    if (!activeAutoReplies) return;
    
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();
        
        if (data.success) {
            const sessions = data.sessions;
            let activeConfigs = [];
            
            // Fetch auto-reply config for each session
            for (const sessionId of sessions) {
                const configResponse = await fetch(`/api/auto-reply/${sessionId}`);
                const configData = await configResponse.json();
                
                if (configData.success && configData.config.enabled) {
                    activeConfigs.push({
                        sessionId,
                        ...configData.config
                    });
                }
            }
            
            // Update UI
            if (activeConfigs.length === 0) {
                activeAutoReplies.innerHTML = `
                    <div class="text-center text-muted p-4">
                        <i class="fas fa-info-circle mb-2 fa-2x"></i>
                        <p>No active auto-replies configured.</p>
                    </div>
                `;
                return;
            }
            
            activeAutoReplies.innerHTML = `
                <div class="list-group">
                    ${activeConfigs.map(config => `
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="flex-grow-1">
                                    <h6 class="mb-1">
                                        <i class="fas fa-mobile-alt me-2"></i>${config.sessionId}
                                    </h6>
                                    <div class="trigger-list small">
                                        ${config.triggers.map(trigger => `
                                            <div class="trigger-item mb-2">
                                                <span class="badge bg-primary me-2">
                                                    <i class="fas fa-comment-dots me-1"></i>${trigger.word}
                                                </span>
                                                <i class="fas fa-arrow-right text-muted mx-2"></i>
                                                <span class="text-muted">${trigger.response}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <div>
                                    <span class="badge bg-success">
                                        <i class="fas fa-check-circle me-1"></i>Active
                                    </span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error updating active auto-replies:', error);
        activeAutoReplies.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>Error loading active auto-replies
            </div>
        `;
    }
}

// View session QR code
function viewSessionQR(sessionId) {
    fetch(`/api/session/${sessionId}/qr`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.qrCode) {
                let base64Data = data.qrCode;
                
                // If the base64 string doesn't start with 'data:image', add the proper prefix
                if (!base64Data.startsWith('data:image')) {
                    base64Data = `data:image/png;base64,${base64Data}`;
                }
                
                qrImage.innerHTML = `<img src="${base64Data}" alt="WhatsApp QR Code" class="img-fluid">`;
                qrModal.show();
            } else {
                showToast('Error', 'Failed to get QR code', 'error');
            }
        })
        .catch(error => {
            console.error('Error getting QR code:', error);
            showToast('Error', 'Failed to get QR code', 'error');
        });
}

// View session details
function viewSessionDetail(sessionId) {
    fetch(`/api/session/${sessionId}/info`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const info = data.info || { status: 'Unknown' };
                const status = info.status || 'Unknown';
                const isConnected = isSessionConnected(status);
                const statusClass = isConnected ? 'online' : 'offline';
                const statusText = isConnected ? 'Connected' : 'Disconnected';
                
                sessionDetailContent.innerHTML = `
                    <div class="session-detail-header">
                        <h5><i class="fas fa-mobile-alt me-2"></i>${sessionId}</h5>
                        <span class="status-badge ${statusClass}"><i class="fas fa-circle me-1"></i>${statusText}</span>
                    </div>
                    <hr>
                    <div class="session-detail-info">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="info-item">
                                    <i class="fas fa-plug me-2"></i>
                                    <strong>Status:</strong> ${statusText}
                                </div>
                                <div class="info-item">
                                    <i class="fas fa-paper-plane me-2"></i>
                                    <strong>Messages Sent:</strong> ${info.messageCount || '0'}
                                </div>
                                <div class="info-item">
                                    <i class="fas fa-calendar-alt me-2"></i>
                                    <strong>Created:</strong> ${new Date(info.createdAt || Date.now()).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <div class="mt-4 text-end">
                            ${!isConnected ? 
                                `<button class="btn btn-sm btn-primary reconnect-btn me-2" onclick="reconnectSession('${sessionId}')">
                                    <i class="fas fa-redo-alt me-1"></i>Reconnect
                                </button>` : ''
                            }
                            <button class="btn btn-sm btn-danger" onclick="closeSession('${sessionId}')">
                                <i class="fas fa-times me-1"></i>Close Session
                            </button>
                        </div>
                    </div>
                `;
                
                sessionDetailModal.show();
            } else {
                showToast('Error', 'Failed to get session details', 'error');
            }
        })
        .catch(error => {
            console.error('Error getting session details:', error);
            showToast('Error', 'Failed to get session details', 'error');
        });
}

// Close a session
function closeSession(sessionId) {
    if (!confirm(`Are you sure you want to close session ${sessionId}?`)) {
        return;
    }
    
    fetch(`/api/session/${sessionId}/close`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('Success', `Session ${sessionId} closed`, 'success');
                loadSessions();
                updateStats();
            } else {
                showToast('Error', 'Failed to close session', 'error');
            }
        })
        .catch(error => {
            console.error('Error closing session:', error);
            showToast('Error', 'Failed to close session', 'error');
        });
}

// Send a single message
async function sendMessage(event) {
    event.preventDefault();
    
    const sessionId = sessionSelect.value;
    const phoneNumber = phoneNumberInput.value.trim();
    const message = messageTextInput.value.trim();
    
    if (!sessionId) {
        showToast('Error', 'Please select a session', 'error');
        return;
    }
    
    if (!phoneNumber) {
        showToast('Error', 'Please enter a phone number', 'error');
        return;
    }
    
    if (!message) {
        showToast('Error', 'Please enter a message', 'error');
        return;
    }
    
    // Show sending indicator
    const sendButton = sendMessageForm.querySelector('button[type="submit"]');
    const originalText = sendButton.innerHTML;
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId,
                to: phoneNumber,
                message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Success', 'Message sent successfully', 'success');
            
            // Add to recent messages
            addRecentMessage(sessionId, phoneNumber, message);
            
            // Clear message field
            messageTextInput.value = '';
            
            // Increment counter
            messagesCounter++;
            updateStats();
        } else {
            showToast('Error', `Failed to send message: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error', 'Failed to send message', 'error');
    } finally {
        // Restore button
        sendButton.disabled = false;
        sendButton.innerHTML = originalText;
    }
}

// Send bulk messages
async function sendBulkMessages(event) {
    event.preventDefault();
    
    const sessionId = bulkSessionSelect.value;
    const phoneNumbersList = bulkPhoneNumbers.value.trim();
    const message = bulkMessageText.value.trim();
    const delay = parseInt(bulkDelay.value) || 1000;
    
    if (!sessionId) {
        showToast('Error', 'Please select a session', 'error');
        return;
    }
    
    if (!phoneNumbersList) {
        showToast('Error', 'Please enter phone numbers', 'error');
        return;
    }
    
    if (!message) {
        showToast('Error', 'Please enter a message', 'error');
        return;
    }
    
    // Parse phone numbers
    const phoneNumbers = phoneNumbersList.split(/[\n,]/)
        .map(num => num.trim())
        .filter(num => num);
    
    if (phoneNumbers.length === 0) {
        showToast('Error', 'No valid phone numbers found', 'error');
        return;
    }
    
    // Confirm bulk operation
    if (!confirm(`Are you sure you want to send this message to ${phoneNumbers.length} contacts? This might take a while.`)) {
        return;
    }
    
    // Show progress card
    bulkProgressCard.classList.remove('d-none');
    bulkTotal.textContent = phoneNumbers.length;
    bulkSent.textContent = '0';
    bulkProgressBar.style.width = '0%';
    bulkProgressBar.setAttribute('aria-valuenow', 0);
    bulkProgressLog.innerHTML = '';
    
    // Disable form
    const submitButton = bulkMessageForm.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    bulkSessionSelect.disabled = true;
    bulkPhoneNumbers.disabled = true;
    bulkMessageText.disabled = true;
    bulkDelay.disabled = true;
    
    // Process phone numbers
    let sent = 0;
    
    for (const [index, phone] of phoneNumbers.entries()) {
        try {
            // Update progress
            const percent = Math.round((index / phoneNumbers.length) * 100);
            bulkProgressBar.style.width = `${percent}%`;
            bulkProgressBar.setAttribute('aria-valuenow', percent);
            
            // Send message
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId,
                    to: phone,
                    message
                })
            });
            
            const data = await response.json();
            
            // Add to log
            const logItem = document.createElement('div');
            if (data.success) {
                logItem.className = 'log-item success';
                logItem.innerHTML = `<i class="fas fa-check-circle me-2"></i>${phone}: Message sent successfully`;
                sent++;
                
                // Increment counter
                messagesCounter++;
                
                // Update sent counter
                bulkSent.textContent = sent;
                
                // Add to recent messages
                addRecentMessage(sessionId, phone, message);
            } else {
                logItem.className = 'log-item error';
                logItem.innerHTML = `<i class="fas fa-times-circle me-2"></i>${phone}: Failed - ${data.error || 'Unknown error'}`;
            }
            bulkProgressLog.appendChild(logItem);
            
            // Wait for delay
            if (index < phoneNumbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            console.error('Error sending message to', phone, error);
            
            // Add to log
            const logItem = document.createElement('div');
            logItem.className = 'log-item error';
            logItem.innerHTML = `<i class="fas fa-times-circle me-2"></i>${phone}: Error - ${error.message || 'Unknown error'}`;
            bulkProgressLog.appendChild(logItem);
        }
    }
    
    // Update final progress
    bulkProgressBar.style.width = '100%';
    bulkProgressBar.setAttribute('aria-valuenow', 100);
    bulkSent.textContent = sent;
    
    // Re-enable form
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
    bulkSessionSelect.disabled = false;
    bulkPhoneNumbers.disabled = false;
    bulkMessageText.disabled = false;
    bulkDelay.disabled = false;
    
    // Show toast
    showToast('Success', `Bulk message operation completed. Sent ${sent} out of ${phoneNumbers.length} messages.`, 'success');
    
    // Update stats
    updateStats();
}

// Add a message to recent messages
function addRecentMessage(sessionId, phone, message) {
    if (!recentMessagesList) return;
    
    // Format the message for display
    const formattedMessage = message.length > 50 
        ? `${message.slice(0, 50)}...` 
        : message;
    
    // Add to array with formatted data
    recentMessages.unshift({
        sessionId,
        recipient: phone,
        message: formattedMessage,
        timestamp: new Date(),
        status: 'sent'  // Add status for visual feedback
    });
    
    // Limit array size
    if (recentMessages.length > MAX_RECENT_MESSAGES) {
        recentMessages.pop();
    }
    
    // Update UI
    updateRecentMessages();
}

// Update recent messages list
function updateRecentMessages() {
    if (!recentMessagesList) return;
    
    recentMessagesList.innerHTML = '';
    
    if (recentMessages.length === 0) {
        recentMessagesList.innerHTML = `
            <div class="text-center p-4 text-muted">
                <i class="fas fa-comment-dots mb-2 fa-2x"></i>
                <p>No recent messages. Send a message to see it here.</p>
            </div>
        `;
        return;
    }
    
    const table = document.createElement('div');
    table.className = 'recent-messages-table';
    
    // Add table header
    const header = document.createElement('div');
    header.className = 'recent-messages-header';
    header.innerHTML = `
        <div class="header-cell" style="width: 15%">Session</div>
        <div class="header-cell" style="width: 20%">Recipient</div>
        <div class="header-cell" style="width: 35%">Message</div>
        <div class="header-cell" style="width: 15%">Status</div>
        <div class="header-cell" style="width: 15%">Time</div>
    `;
    table.appendChild(header);
    
    // Add messages
    recentMessages.forEach(msg => {
        const row = document.createElement('div');
        row.className = 'recent-messages-row fade-in';
        
        const timeString = msg.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const dateString = msg.timestamp.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
        });
        
        row.innerHTML = `
            <div class="cell session-cell" style="width: 15%">
                <div class="session-info">
                    <div class="session-icon">
                        <i class="fas fa-mobile-alt"></i>
                    </div>
                    <span class="session-name">${msg.sessionId}</span>
                </div>
            </div>
            <div class="cell recipient-cell" style="width: 20%">
                <div class="recipient-info">
                    <i class="fas fa-user me-2"></i>
                    <span>${msg.recipient || 'N/A'}</span>
                </div>
            </div>
            <div class="cell message-cell" style="width: 35%">
                <div class="message-content">
                    <div class="message-text">${msg.message}</div>
                </div>
            </div>
            <div class="cell status-cell" style="width: 15%">
                <div class="status-info ${msg.status === 'received' ? 'text-primary' : 'text-success'}">
                    ${msg.status === 'received' 
                        ? '<i class="fas fa-inbox me-1"></i><span>Received</span>'
                        : '<i class="fas fa-check-double me-1"></i><span>Sent</span>'
                    }
                </div>
            </div>
            <div class="cell time-cell" style="width: 15%">
                <div class="time-info">
                    <span class="time">${timeString}</span>
                    <span class="date">${dateString}</span>
                </div>
            </div>
        `;
        
        table.appendChild(row);
    });
    
    recentMessagesList.appendChild(table);
    
    // Add CSS styles for the recent messages
    const style = document.createElement('style');
    style.textContent = `
        .recent-messages-table {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .recent-messages-header {
            display: flex;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            padding: 12px 16px;
            font-weight: 600;
            color: #495057;
        }
        
        .recent-messages-row {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #e9ecef;
            transition: background-color 0.2s;
        }
        
        .recent-messages-row:last-child {
            border-bottom: none;
        }
        
        .recent-messages-row:hover {
            background-color: #f8f9fa;
        }
        
        .header-cell {
            padding: 0 8px;
            font-size: 0.9rem;
        }
        
        .cell {
            padding: 0 8px;
        }
        
        .session-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .session-icon {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background-color: #e3f2fd;
            color: #1976d2;
        }
        
        .session-name {
            font-weight: 500;
            color: #1a1a1a;
            font-size: 0.9rem;
        }
        
        .recipient-info {
            display: flex;
            align-items: center;
            color: #1a1a1a;
            font-size: 0.9rem;
        }
        
        .message-content {
            display: flex;
            flex-direction: column;
        }
        
        .message-text {
            color: #1a1a1a;
            font-size: 0.95rem;
            line-height: 1.4;
        }
        
        .status-info {
            display: flex;
            align-items: center;
            font-size: 0.9rem;
            color: #1a1a1a;
        }
        
        .time-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
        }
        
        .time {
            font-weight: 500;
            color: #1a1a1a;
            font-size: 0.9rem;
        }
        
        .date {
            color: #6c757d;
            font-size: 0.8rem;
        }
        
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// Show toast notification
function showToast(title, message, type = 'info') {
    if (!statusToast) return;
    
    // Set icon based on type
    let icon = 'fa-info-circle';
    let bgClass = 'bg-info';
    
    switch (type) {
        case 'success':
            icon = 'fa-check-circle';
            bgClass = 'bg-success';
            break;
        case 'error':
            icon = 'fa-times-circle';
            bgClass = 'bg-danger';
            break;
        case 'warning':
            icon = 'fa-exclamation-triangle';
            bgClass = 'bg-warning';
            break;
    }
    
    // Set toast content
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toastIcon.className = `fas ${icon} me-2`;
    toastTime.textContent = new Date().toLocaleTimeString();
    
    // Remove existing classes and add new one
    statusToast.className = statusToast.className.replace(/bg-\w+/, '');
    statusToast.classList.add(bgClass);
    
    // Show toast
    toast.show();
}

// Helper function to check if session status is connected
function isSessionConnected(status) {
    const connectedStates = ['CONNECTED', 'PLUGGED', 'AUTHENTICATED', 'inChat', 'isLogged'];
    if (!status) return false;
    return connectedStates.includes(status.toUpperCase());
}

// Helper function to check if session status is disconnected
function isSessionDisconnected(status) {
    const disconnectedStates = ['DISCONNECTED', 'UNPLUGGED', 'CONFLICT', 'UNLAUNCHED', 'notLogged', 'browserClose'];
    if (!status) return true;
    return disconnectedStates.includes(status.toUpperCase());
}

// Update session status in the UI
function updateSessionStatus(sessionId, status) {
    const isConnected = isSessionConnected(status);
    const isDisconnected = isSessionDisconnected(status);
    
    let statusClass = 'warning';
    let statusLabel = status || 'Unknown';
    let iconClass = 'text-warning';
    
    if (isConnected) {
        statusClass = 'online';
        statusLabel = 'Connected';
        iconClass = 'text-success';
    } else if (isDisconnected) {
        statusClass = 'offline';
        statusLabel = 'Disconnected';
        iconClass = 'text-danger';
    }
    
    // Update session items in the list
    document.querySelectorAll(`[data-session="${sessionId}"]`).forEach(item => {
        const parent = item.closest('.session-item');
        if (parent) {
            const statusIndicator = parent.querySelector('.text-muted small i');
            if (statusIndicator) {
                statusIndicator.className = `fas fa-circle ${iconClass} me-1`;
                parent.querySelector('.text-muted small').innerHTML = 
                    `<i class="fas fa-circle ${iconClass} me-1"></i> ${statusLabel}`;
            }
        }
    });
    
    // Update status in the details view
    const statusCards = document.querySelectorAll('.session-detail-card .card');
    statusCards.forEach(card => {
        const titleElement = card.querySelector('.card-title');
        if (titleElement && titleElement.textContent.includes(sessionId)) {
            const badge = card.querySelector('.status-badge');
            if (badge) {
                badge.className = `status-badge ${statusClass}`;
                badge.innerHTML = `<i class="fas fa-circle me-1"></i>${statusLabel}`;
            }
            
            const statusElement = card.querySelector('.col-md-6 .mb-2:first-child strong');
            if (statusElement && statusElement.nextSibling) {
                statusElement.nextSibling.textContent = ` ${statusLabel}`;
            }
            
            // Handle reconnect button
            const buttonsContainer = card.querySelector('.mt-3.text-end');
            if (buttonsContainer) {
                const hasReconnectBtn = !!buttonsContainer.querySelector('.reconnect-btn');
                
                if (isDisconnected && !hasReconnectBtn) {
                    const reconnectBtn = document.createElement('button');
                    reconnectBtn.className = 'btn btn-sm btn-primary reconnect-btn me-2';
                    reconnectBtn.dataset.session = sessionId;
                    reconnectBtn.innerHTML = '<i class="fas fa-redo-alt me-1"></i>Reconnect';
                    reconnectBtn.addEventListener('click', () => reconnectSession(sessionId));
                    
                    const closeBtn = buttonsContainer.querySelector('.close-detail-btn');
                    if (closeBtn) {
                        buttonsContainer.insertBefore(reconnectBtn, closeBtn);
                    } else {
                        buttonsContainer.appendChild(reconnectBtn);
                    }
                } else if (!isDisconnected && hasReconnectBtn) {
                    buttonsContainer.querySelector('.reconnect-btn').remove();
                }
            }
        }
    });
}

// Reconnect a session that was disconnected
function reconnectSession(sessionId) {
    // Set the session ID input and trigger createSession
    if (sessionIdInput) {
        sessionIdInput.value = sessionId;
        createSession();
        showToast('Info', `Attempting to reconnect session ${sessionId}...`, 'info');
    }
}

// Toggle auto-reply functionality
function toggleAutoReply() {
    if (!autoReplyMessage.value.trim()) {
        showToast('Error', 'Please enter an auto-reply message', 'error');
        autoReplyToggle.checked = false;
        return;
    }
    
    autoReplyEnabled = autoReplyToggle.checked;
    updateAutoReplyStatus();
    
    if (autoReplyEnabled) {
        showToast('Success', 'Auto-reply bot activated', 'success');
    } else {
        showToast('Info', 'Auto-reply bot deactivated', 'info');
    }
}

// Handle incoming messages
async function handleIncomingMessage(data) {
    console.log('Incoming message:', data);
    
    const { sessionId, message } = data;
    
    // Skip if it's a status message or system message
    if (message.isStatus || message.type === 'status' || message.isSystem || message.type === 'system') {
        return;
    }
    
    // Skip if it's a group message and not from the group
    if (message.isGroupMsg && !message.fromMe) {
        return;
    }
    
    // Skip if it's a broadcast message
    if (message.isBroadcast) {
        return;
    }
    
    // Skip if it's a reaction
    if (message.type === 'reaction') {
        return;
    }
    
    // Skip if it's a message from the client itself
    if (message.fromMe) {
        return;
    }
    
    // Add to recent messages with 'received' status
    if (recentMessagesList) {
        recentMessages.unshift({
            sessionId,
            recipient: message.from || 'Unknown',
            message: message.body || message.content || 'No content',
            timestamp: new Date(),
            status: 'received'
        });
        
        // Limit array size
        if (recentMessages.length > MAX_RECENT_MESSAGES) {
            recentMessages.pop();
        }
        
        // Update UI
        updateRecentMessages();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);