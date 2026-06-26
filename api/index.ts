import connectDB from "../DB/connect";
import app from "../index";

let dbConnected = false;

const ensureDb = async () => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
};

export default async function handler(req: any, res: any) {
  await ensureDb();
  return app(req, res);
}
