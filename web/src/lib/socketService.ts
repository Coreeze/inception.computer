import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (playerID: string) => {
  if (socket?.connected || socket?.active) return socket;
  if (socket) socket.disconnect();

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

  socket = io(serverUrl, {
    query: { playerID },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
