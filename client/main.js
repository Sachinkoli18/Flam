// client/main.js
import { 
    handleFullCanvasState, 
    handleRemoteDrawPoint, 
    handleNewStrokeFinished,
    handleGlobalUndoRedo 
} from './canvas.js';


// Assign the canvas handlers to the websocket module's variables
window.onRemoteDrawPoint = handleRemoteDrawPoint;
window.onNewStrokeFinished = handleNewStrokeFinished;
window.onGlobalUndoRedo = handleGlobalUndoRedo;
window.onFullCanvasState = handleFullCanvasState;

// Note: socket, sendDrawPoint, etc., are globally available from websocket.js 
// which is loaded before this file in index.html
console.log('Canvas application initialized. Ready to connect to socket.');