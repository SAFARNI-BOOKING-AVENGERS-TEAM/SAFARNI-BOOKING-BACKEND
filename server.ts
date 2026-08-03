import { createServer } from "http";
import app from "./app";
import connectDB from "./DB/connect";
import { initSocket } from "./socket/socket";

const port = process.env.PORT || 3000;

const httpServer = createServer(app);
initSocket(httpServer);

const startServer = async () => {
  await connectDB();

  httpServer.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
};

if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  startServer();
}