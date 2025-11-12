# Collaborative Canvas Architecture Overview

## 1. State Management (Single Source of Truth)

The **Node.js Server** is the **Single Source of Truth (SSOT)** for the entire canvas state.

* **Server State (`server/drawing-state.js`):**
    * Maintains a canonical, ordered array of **Strokes**.
    * Each `Stroke` object includes: `id`, `userId`, `points` (the full list of coordinates), `color`, `width`, `type`, and crucially, a `visible` boolean flag.
    * Maintains a list of `Users` and their current properties (name, color, cursor position).

* **Client State (`client/websocket.js`):**
    * Maintains a local copy of the canonical `Strokes` history for efficient redraws.
    * Manages **in-progress** strokes locally, which are *not* yet added to the history.

## 2. Real-Time Drawing Synchronization

We use a two-tiered event strategy for high-frequency updates and state consistency:

| Event Type | Purpose | Sender | Data Sent | Receiver Handling |
| :--- | :--- | :--- | :--- | :--- |
| **`draw_point`** | High-frequency streaming for visual smoothness. | Client (on mousemove) | `{x, y, strokeId, color, width, type}` | **Other Clients**: Draw the single segment immediately onto the canvas. (Server just broadcasts). |
| **`finish_stroke`** | State finalization (low frequency). | Client (on mouseup) | Full `{points, color, width, type}` | **Server**: Saves the canonical stroke to `strokes` history, assigns official ID, and broadcasts `new_stroke_finished`. |
| **`new_stroke_finished`** | Confirmed state update. | Server | Full Canonical Stroke Object | **All Clients**: Add the stroke to their local history. (No redraw needed as points were already drawn via `draw_point`). |
| **`cursor_move`** | User indicator updates. | Client (on mousemove) | `{x, y}` | **Other Clients**: Update the position of the corresponding remote cursor DOM element. |

## 3. Global Undo/Redo

Undo/Redo is managed exclusively by the server to ensure global consistency.

1.  **Request:** A Client sends an **`undo_request`** (or `redo_request`) to the Server.
2.  **Server Logic:**
    * The Server attempts to find the last `visible: true` stroke in its canonical history and sets its property to `visible: false`. (Redo reverses this).
    * It does **not** delete the stroke. This is the **Command Pattern** implementation for history.
3.  **Broadcast Command:** The Server broadcasts a **`global_undo`** (or `global_redo`) command, specifying the **ID** of the stroke that was affected.
4.  **Client Update:** All Clients receive the command, find the stroke in their local history by ID, update its `visible` status, and then trigger a **full canvas redraw** (`redrawFullCanvas(history)`). This ensures the canvas reflects the new, consistent state.

## 4. Conflict Resolution

* **Drawing:** Server resolves drawing conflicts by accepting and processing events strictly in the order they are received.
* **Undo/Redo:** Conflicts are inherently resolved because the server validates the operation (e.g., "is there an available stroke to undo?") against its SSOT before broadcasting the change.