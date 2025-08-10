// Holds the Socket.IO instance safely (no circular imports)
let ioInstance = null;

export function initRealtime(io) {
  ioInstance = io;

  // Connection handlers live here (NOT in routes)
  ioInstance.on("connection", (socket) => {
    // client should emit("join", userId)
    socket.on("join", (userId) => socket.join(String(userId)));
  });
}

export function emitToUser(userId, type, payload) {
  if (!ioInstance) return; // in case not ready
  ioInstance.to(String(userId)).emit("tasks:update", { type, payload });
}
