import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken, TokenType } from "../utils/security/token.security";

export let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      credentials: true,
    },
  });

  // Authenticate every socket connection using the same JWT from cookies
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        return next(new Error("Authentication required"));
      }

      const parsedCookies = Object.fromEntries(
        cookieHeader.split("; ").map((c) => {
          const [key, ...v] = c.split("=");
          return [key, v.join("=")];
        })
      );

      const token = parsedCookies["access_token"];
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const { user } = await verifyToken(token, TokenType.access);
      (socket as any).userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    socket.join(userId); // each user gets a private "room" named after their own ID
    console.log(`[socket]: User ${userId} connected`);

    socket.on("disconnect", () => {
      console.log(`[socket]: User ${userId} disconnected`);
    });
  });

  return io;
};