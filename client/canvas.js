// client/canvas.js
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// Set canvas dimensions to fit container
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// --- Local Drawing State ---
let isDrawing = false;
let currentStroke = null;
let lastPosition = { x: 0, y: 0 };
let currentTool = 'pen';
let currentColor = '#000000';
let currentWidth = 5;

// Temporary list to hold in-progress remote strokes
// Used to draw high-frequency remote points before the finished stroke event arrives
const remoteStrokes = {}; 

// --- Canvas Utility Functions ---

// Clears the entire canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Draws a single, complete stroke from the history list
function drawStroke(stroke) {
    if (stroke.points.length < 2 || !stroke.visible) return;
    
    // Set properties for pen or eraser
    if (stroke.type === 'eraser') {
        ctx.strokeStyle = '#fff'; // Erase by drawing white over the background
        ctx.lineCap = 'square'; // Eraser is typically square/flat
        ctx.lineWidth = stroke.width;
    } else {
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = stroke.width;
    }

    ctx.beginPath();
    // Start at the first point
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    // Draw lines between subsequent points
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    ctx.stroke();
}

// Redraws the entire canvas based on the master history state
function redrawFullCanvas(history) {
    clearCanvas();
    history.forEach(drawStroke);
    // Note: We don't draw remoteStrokes here, as they are *in progress*
}

// --- Local Drawing Event Handlers ---

function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function startDrawing(e) {
    const pos = getMousePos(e);
    isDrawing = true;
    lastPosition = pos;

    // Initialize the local stroke object
    currentStroke = {
        id: `${localUserId}-${Date.now()}`, // Client-side temp ID
        points: [{ x: pos.x, y: pos.y }],
        color: currentColor,
        width: currentWidth,
        type: currentTool,
        userId: localUserId
    };
    
    // Initial draw to mark the start point
    drawSegment(ctx, lastPosition.x, lastPosition.y, pos.x, pos.y, currentColor, currentWidth, currentTool);
    
    // Send the first point to the server
    sendDrawPoint(pos.x, pos.y, currentStroke.id, currentColor, currentWidth, currentTool);
}

function draw(e) {
    const pos = getMousePos(e);
    
    // 1. Cursor Movement (always send, even if not drawing)
    sendCursorMove(pos.x, pos.y);
    
    if (!isDrawing) return;

    // 2. Local Drawing
    drawSegment(ctx, lastPosition.x, lastPosition.y, pos.x, pos.y, currentColor, currentWidth, currentTool);
    
    // Add point to the local stroke data
    currentStroke.points.push(pos);
    
    // 3. Remote Sync (send point to server/others)
    sendDrawPoint(pos.x, pos.y, currentStroke.id, currentColor, currentWidth, currentTool);

    lastPosition = pos;
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Send the completed, canonical stroke data to the server for history management
    sendFinishStroke(currentStroke);
    currentStroke = null;
}

// Low-level function to draw a single line segment
function drawSegment(context, x1, y1, x2, y2, color, width, type) {
    context.beginPath();
    if (type === 'eraser') {
        context.strokeStyle = '#fff';
        context.lineCap = 'square';
        context.lineWidth = width;
    } else {
        context.strokeStyle = color;
        context.lineCap = 'round';
        context.lineWidth = width;
    }
    
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.closePath();
}

// --- Remote Drawing Functions ---

// Handles high-frequency remote point events
function handleRemoteDrawPoint(data) {
    // data: { userId, x, y, strokeId, color, width, type }
    
    const { userId, x, y, strokeId, color, width, type } = data;
    
    if (!remoteStrokes[strokeId]) {
        // Start a new remote stroke
        remoteStrokes[strokeId] = { x: x, y: y, color, width, type };
    } else {
        // Draw the segment using the previous point and the new point
        const prev = remoteStrokes[strokeId];
        drawSegment(ctx, prev.x, prev.y, x, y, color, width, type);
        
        // Update the last recorded point for this remote stroke
        remoteStrokes[strokeId].x = x;
        remoteStrokes[strokeId].y = y;
    }
}

// Handles the finished stroke event from the server
function handleNewStrokeFinished(stroke) {
    // Clean up the temporary remote stroke object since the canonical one is now in history
    delete remoteStrokes[stroke.id];
    
    // IMPORTANT: Since the client has already drawn the remote points, 
    // we don't need to redraw the canvas here. 
    // The history is updated in websocket.js, and the next redraw will be correct.
}


// --- Event Listeners ---

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
// Use window listeners for mouseup/mouseout to handle dragging off the canvas
window.addEventListener('mouseup', stopDrawing);
window.addEventListener('mouseout', (e) => {
    // Only stop drawing if the mouse leaves the canvas area specifically
    if(e.target === canvas) stopDrawing(e);
});
// Also handle touch events for mobile
canvas.addEventListener('touchstart', (e) => startDrawing(e.touches[0]));
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
canvas.addEventListener('touchend', stopDrawing);


// --- Tool Controls ---
const colorPicker = document.getElementById('color-picker');
const widthSlider = document.getElementById('stroke-width');
const widthValueSpan = document.getElementById('width-value');
const brushBtn = document.getElementById('brush-tool');
const eraserBtn = document.getElementById('eraser-tool');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const controls = document.getElementById('controls');


controls.addEventListener('click', (e) => {
    // Handle tool selection
    if (e.target.tagName === 'BUTTON') {
        // Remove 'active' from all buttons
        brushBtn.classList.remove('active');
        eraserBtn.classList.remove('active');
        
        if (e.target.id === 'brush-tool') {
            currentTool = 'pen';
            e.target.classList.add('active');
        } else if (e.target.id === 'eraser-tool') {
            currentTool = 'eraser';
            e.target.classList.add('active');
        } else if (e.target.id === 'undo-btn') {
            sendUndoRequest();
        } else if (e.target.id === 'redo-btn') {
            sendRedoRequest();
        }
    }
});


colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    currentTool = 'pen';
    brushBtn.classList.add('active');
    eraserBtn.classList.remove('active');
});

widthSlider.addEventListener('input', (e) => {
    currentWidth = parseInt(e.target.value, 10);
    widthValueSpan.textContent = `${currentWidth}px`;
});


// Export functions to be linked by main.js
// This makes the websocket.js handlers talk to the canvas logic
export { 
    redrawFullCanvas as handleFullCanvasState,
    handleRemoteDrawPoint, 
    handleNewStrokeFinished,
    redrawFullCanvas as handleGlobalUndoRedo
};