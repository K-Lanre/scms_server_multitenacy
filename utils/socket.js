let io;

module.exports = {
  init: (httpServer) => {
    const { Server } = require("socket.io");
    io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST", "PATCH", "DELETE"],
        credentials: true
      },
      allowEIO3: true,
      transports: ['websocket', 'polling']
    });

    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);

      // Join a private room for the user
      socket.on("join", (userId) => {
        if (userId) {
          const roomName = `user_${userId}`;
          socket.join(roomName);
          console.log(`Socket ${socket.id} joined room: ${roomName}`);
        }
      });

      // Join admin broadcast room
      socket.on("join_admin", () => {
        socket.join("admin_broadcast");
        console.log(`Socket ${socket.id} joined admin_broadcast`);
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },

  // Helper to emit events to all connected clients
  emit: (event, data) => {
    if (io) {
      io.emit(event, data);
    }
  },

  // Helper to emit events to a specific user's room
  emitToUser: (userId, event, data) => {
    if (io && userId) {
      const roomName = `user_${userId}`;
      io.to(roomName).emit(event, data);
      console.log(`Emitted ${event} to ${roomName}`);
    }
  },

  // Helper to emit events to all admins
  emitToAdmins: (event, data) => {
    if (io) {
      io.to("admin_broadcast").emit(event, data);
      console.log(`Emitted ${event} to admin_broadcast`);
    }
  },

  // Helper to broadcast to everyone
  broadcast: (event, data) => {
    if (io) {
      io.emit(event, data);
    }
  }
};
