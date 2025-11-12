// server/drawing-state.js
class DrawingState {
    constructor() {
        // Master list of all finished strokes
        // Stroke: { id: string, userId: string, points: Array<{x: number, y: number}>, color: string, width: number, type: 'pen' | 'eraser', visible: boolean }
        this.strokes = [];
        this.users = {}; // userId -> { name, color, cursor: {x, y} }
        this.nextStrokeId = 1;
    }

    // --- User Management ---

    addUser(id, name, color) {
        this.users[id] = { id, name, color, cursor: { x: 0, y: 0 } };
    }

    removeUser(id) {
        delete this.users[id];
    }

    getOnlineUsers() {
        return Object.values(this.users);
    }
    
    updateCursor(userId, x, y) {
        if (this.users[userId]) {
            this.users[userId].cursor = { x, y };
        }
    }

    // --- Drawing Management ---
    
    // Starts a new stroke (when a user presses the mouse)
    startNewStroke(userId, color, width, type) {
        const newStroke = {
            id: `s${this.nextStrokeId++}`,
            userId: userId,
            points: [],
            color: color,
            width: width,
            type: type, // 'pen' or 'eraser'
            visible: true
        };
        // Temporarily store the stroke until it's finished (points are added later)
        return newStroke;
    }

    // Adds points to the last active stroke and returns the point data
    addPointToStroke(strokeId, x, y) {
        // In a real app, you'd find the active stroke object
        // For simplicity, the client sends points *and* the stroke ID/metadata back to broadcast
        // The server only cares about *finished* strokes for history
        return { x, y };
    }

    // Finishes a stroke and adds it to the master history (when a user lifts the mouse)
    finishStroke(userId, strokeData) {
        // Ensure strokeData includes points, color, width, type, etc.
        const newStroke = {
            ...strokeData,
            id: `s${this.nextStrokeId++}`,
            userId: userId,
            visible: true
        };
        this.strokes.push(newStroke);
        return newStroke;
    }

    // --- Undo/Redo ---

    undoLastStroke() {
        // Find the last visible stroke
        for (let i = this.strokes.length - 1; i >= 0; i--) {
            if (this.strokes[i].visible) {
                this.strokes[i].visible = false;
                return this.strokes[i].id; // Return the ID of the stroke that was undone
            }
        }
        return null; // Nothing to undo
    }

    redoLastUndoneStroke() {
        // Find the last *invisible* stroke
        for (let i = 0; i < this.strokes.length; i++) {
            if (!this.strokes[i].visible) {
                this.strokes[i].visible = true;
                return this.strokes[i].id; // Return the ID of the stroke that was redone
            }
        }
        return null; // Nothing to redo
    }
    
    // Get the current list of all *visible* strokes for a new client joining
    getFullState() {
        return {
            strokes: this.strokes.filter(s => s.visible),
            users: this.getOnlineUsers()
        };
    }
}

module.exports = new DrawingState();