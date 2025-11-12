// server/rooms.js

const CANVAS_ROOM_ID = 'main-canvas-room';
const activeRooms = {
    [CANVAS_ROOM_ID]: {
        name: 'Shared Canvas',
        host: null, // Could track the host if needed
        users: new Set() // Tracks user IDs in this room
    }
};

/**
 * Gets the default room ID for all canvas operations.
 * @returns {string} The default room ID.
 */
function getDefaultRoomId() {
    return CANVAS_ROOM_ID;
}

/**
 * Adds a user to the default canvas room.
 * @param {string} userId - The Socket.io ID of the user.
 */
function joinDefaultRoom(userId) {
    activeRooms[CANVAS_ROOM_ID].users.add(userId);
}

/**
 * Removes a user from the default canvas room.
 * @param {string} userId - The Socket.io ID of the user.
 */
function leaveDefaultRoom(userId) {
    activeRooms[CANVAS_ROOM_ID].users.delete(userId);
}

/**
 * Gets the number of users in the default room.
 * @returns {number} The count of users.
 */
function getUserCount() {
    return activeRooms[CANVAS_ROOM_ID].users.size;
}

module.exports = {
    getDefaultRoomId,
    joinDefaultRoom,
    leaveDefaultRoom,
    getUserCount
    // Add logic for creating/deleting rooms if scaling
};