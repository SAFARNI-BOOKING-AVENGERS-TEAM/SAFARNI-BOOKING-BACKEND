import { createServer } from "http";
import app from "./app";
import connectDB from "./DB/connect";
import { initSocket } from "./socket/socket";

const DEFAULT_PORT = 5000;
const configuredPort = Number(process.env.PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;

const httpServer = createServer(app);
initSocket(httpServer);

const startServer = async () => {
  await connectDB();

  httpServer.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
};

if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  void startServer();
}
