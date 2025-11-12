// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const drawingState = require('./drawing-state');

const app = express();
const server = http.createServer(app);
// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for local development
        methods: ["GET", "POST"]
    }
});

// Serve the client files
app.use(express.static('client'));

// Simple room/user management setup
const USER_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FDD835', '#9C27B0', '#FF7043'];
let userCounter = 0;

io.on('connection', (socket) => {
    // --- 1. User Initialization ---
    userCounter++;
    const userId = socket.id;
    const userName = `User ${userCounter}`;
    const userColor = USER_COLORS[(userCounter - 1) % USER_COLORS.length];

    drawingState.addUser(userId, userName, userColor);
    console.log(`${userName} connected (${userId})`);
    
    // Send the joining user their ID/Name/Color
    socket.emit('user_init', { userId, userName, userColor });
    
    // Send the current canvas state to the joining user
    socket.emit('canvas_state', drawingState.getFullState());
    
    // Announce the new user to everyone
    io.emit('user_update', drawingState.getOnlineUsers());

    // --- 2. Real-time Drawing (High-Frequency Events) ---

    // A single point during an active stroke
    socket.on('draw_point', (data) => {
        // data: { x, y, strokeId, color, width, type }
        // Broadcast the point to all *other* clients for real-time appearance
        socket.broadcast.emit('draw_point', { userId: socket.id, ...data });
    });
    
    // Cursor position update
    socket.on('cursor_move', (pos) => {
        drawingState.updateCursor(socket.id, pos.x, pos.y);
        // Broadcast the cursor position to all *other* clients
        socket.broadcast.emit('cursor_move', { userId: socket.id, x: pos.x, y: pos.y });
    });

    // --- 3. Stroke Finalization (State-Changing Events) ---
    
    // A complete stroke is finished (mouse up)
    socket.on('finish_stroke', (strokeData) => {
        // The server stores the full, canonical stroke
        const newStroke = drawingState.finishStroke(userId, strokeData);
        // Broadcast the *finished* stroke to all clients to update their history
        io.emit('new_stroke_finished', newStroke);
    });

    // --- 4. Global Undo/Redo ---
    
    socket.on('undo_request', () => {
        const undoneStrokeId = drawingState.undoLastStroke();
        if (undoneStrokeId) {
            // Broadcast the command to undo the specific stroke ID
            io.emit('global_undo', { strokeId: undoneStrokeId, requesterId: userId });
        } else {
            // Optional: send a message back to the requester if nothing happened
            socket.emit('message', { type: 'info', text: 'Nothing to undo.' });
        }
    });

    socket.on('redo_request', () => {
        const redoneStrokeId = drawingState.redoLastUndoneStroke();
        if (redoneStrokeId) {
            // Broadcast the command to redo the specific stroke ID
            io.emit('global_redo', { strokeId: redoneStrokeId, requesterId: userId });
        } else {
            socket.emit('message', { type: 'info', text: 'Nothing to redo.' });
        }
    });

    // --- 5. Disconnection ---

    socket.on('disconnect', () => {
        drawingState.removeUser(userId);
        console.log(`${userName} disconnected (${userId})`);
        // Announce the user update to everyone
        io.emit('user_update', drawingState.getOnlineUsers());
        // Clean up any temporary resources if needed
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}. Access at http://localhost:${PORT}`);
});