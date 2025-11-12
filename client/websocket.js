// client/websocket.js
const socket = io();
let localUserId = null;
let localUserName = 'Guest';
let localUserColor = '#000000';

const remoteCursorsEl = document.getElementById('remote-cursors');
const userListEl = document.getElementById('user-list');
const userCountEl = document.getElementById('user-count');

// --- State and Handlers (Will be connected to canvas.js) ---
let canvasStateHistory = [];
let onlineUsers = {};

// Handler functions to be defined in main.js/canvas.js
let onRemoteDrawPoint = () => {};
let onNewStrokeFinished = () => {};
let onGlobalUndoRedo = () => {};
let onFullCanvasState = () => {};

// --- Socket Event Listeners ---

// 1. Initialization
socket.on('user_init', ({ userId, userName, userColor }) => {
    localUserId = userId;
    localUserName = userName;
    localUserColor = userColor;
    console.log(`Initialized as ${localUserName} (${localUserId})`);
});

// 2. State Sync on Join
socket.on('canvas_state', (state) => {
    canvasStateHistory = state.strokes;
    onlineUsers = state.users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {});
    
    // Trigger the canvas to draw the full history
    onFullCanvasState(canvasStateHistory);
    updateUserList();
});

// 3. Real-time Drawing
socket.on('draw_point', (data) => {
    // data: { userId, x, y, strokeId, color, width, type }
    onRemoteDrawPoint(data);
});

// 4. Stroke Finalization
socket.on('new_stroke_finished', (stroke) => {
    // Add the canonical finished stroke to our local history
    canvasStateHistory.push(stroke);
    // Let the canvas logic handle clean-up/finalization
    onNewStrokeFinished(stroke);
});

// 5. Global Undo/Redo
socket.on('global_undo', ({ strokeId, requesterId }) => {
    // Find and hide the stroke
    const stroke = canvasStateHistory.find(s => s.id === strokeId);
    if (stroke) stroke.visible = false;
    onGlobalUndoRedo(canvasStateHistory); // Redraw the canvas
});

socket.on('global_redo', ({ strokeId, requesterId }) => {
    // Find and show the stroke
    const stroke = canvasStateHistory.find(s => s.id === strokeId);
    if (stroke) stroke.visible = true;
    onGlobalUndoRedo(canvasStateHistory); // Redraw the canvas
});


// 6. User Management
socket.on('user_update', (users) => {
    onlineUsers = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {});
    updateUserList();
});

socket.on('cursor_move', ({ userId, x, y }) => {
    if (userId === localUserId) return; // Don't track local cursor
    
    let cursor = document.getElementById(`cursor-${userId}`);
    
    if (!cursor) {
        // Create the cursor element if it doesn't exist
        cursor = document.createElement('div');
        cursor.id = `cursor-${userId}`;
        cursor.classList.add('remote-cursor');
        const user = onlineUsers[userId];
        cursor.style.backgroundColor = user ? user.color : 'gray';
        cursor.title = user ? user.name : 'Unknown User';
        remoteCursorsEl.appendChild(cursor);
    }
    
    // Update position
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
});

function updateUserList() {
    userListEl.innerHTML = '';
    userCountEl.textContent = Object.keys(onlineUsers).length;
    
    Object.values(onlineUsers).forEach(user => {
        const li = document.createElement('li');
        
        const dot = document.createElement('span');
        dot.classList.add('user-color-dot');
        dot.style.backgroundColor = user.color;
        
        const name = document.createTextNode(`${user.name} ${user.id === localUserId ? '(You)' : ''}`);
        
        li.appendChild(dot);
        li.appendChild(name);
        userListEl.appendChild(li);
        
        // Remove cursor element if the user is no longer in the list (on disconnect)
        if (!onlineUsers[user.id]) {
             document.getElementById(`cursor-${user.id}`)?.remove();
        }
    });
}

// --- Client -> Server Communication Functions ---

// Send a single point while the mouse is down
function sendDrawPoint(x, y, strokeId, color, width, type) {
    socket.emit('draw_point', { x, y, strokeId, color, width, type });
}

// Send the full stroke data when the mouse is released
function sendFinishStroke(strokeData) {
    socket.emit('finish_stroke', strokeData);
}

function sendCursorMove(x, y) {
    socket.emit('cursor_move', { x, y });
}

function sendUndoRequest() {
    socket.emit('undo_request');
}

function sendRedoRequest() {
    socket.emit('redo_request');
}