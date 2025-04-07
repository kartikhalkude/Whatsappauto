const socket = io();
let currentSessionId = null;

document.getElementById('new-session').addEventListener('click', async () => {
    const response = await fetch('/api/session/create', { method: 'POST' });
    const { sessionId } = await response.json();
    createSessionUI(sessionId);
});

function createSessionUI(sessionId) {
    const sessionsDiv = document.getElementById('active-sessions');
    const sessionButton = document.createElement('button');
    sessionButton.innerHTML = `<i class="fas fa-user"></i> Session ${sessionId.slice(0, 6)}`;
    sessionButton.onclick = () => activateSession(sessionId);
    sessionsDiv.appendChild(sessionButton);
    activateSession(sessionId);
}

function activateSession(sessionId) {
    currentSessionId = sessionId;
    document.getElementById('session-container').classList.remove('hidden');
    
    // Highlight active session button
    const buttons = document.querySelectorAll('#active-sessions button');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeButton = Array.from(buttons).find(btn => btn.textContent.includes(sessionId.slice(0, 6)));
    if (activeButton) activeButton.classList.add('active');
    
    socket.emit('join-session', sessionId);
}

socket.on('connection-status', (status) => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = status;
    statusDiv.className = `status-badge ${status.toLowerCase().includes('connected') ? 'connected' : 'disconnected'}`;
});

socket.on('qr', (qr) => {
    const qrcodeContainer = document.getElementById('qrcode-container');
    qrcodeContainer.innerHTML = '';
    QRCode.toString(qr, {
        type: 'svg',
        width: 256,
        margin: 4,
        color: {
            dark: '#128C7E',
            light: '#FFFFFF'
        }
    }, function (error, string) {
        if (error) {
            console.error('Error generating QR code:', error);
            qrcodeContainer.innerHTML = '<div class="qr-error"><i class="fas fa-exclamation-circle"></i><p>Error generating QR code</p></div>';
        } else {
            qrcodeContainer.innerHTML = string;
        }
    });
});

socket.on('authenticated', () => {
    const qrcodeContainer = document.getElementById('qrcode-container');
    qrcodeContainer.innerHTML = '<div class="connection-success"><i class="fas fa-check-circle"></i><h3>WhatsApp Connected!</h3></div>';
});

socket.on('triggers-update', (triggers) => {
    const triggersList = document.getElementById('triggers-list');
    triggersList.innerHTML = Object.entries(triggers)
        .map(([trigger, response]) => `
            <div class="trigger-item">
                <h3><i class="fas fa-bolt"></i> ${trigger}</h3>
                <p><i class="fas fa-reply"></i> ${response}</p>
            </div>
        `).join('');
});