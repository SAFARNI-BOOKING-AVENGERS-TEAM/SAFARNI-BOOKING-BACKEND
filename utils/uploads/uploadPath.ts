import path from "path";

// Resolve uploads from the process working directory so Multer and Express
// always point at the exact same folder in both ts-node development and the
// compiled dist build.
export const uploadsDir = path.resolve(process.cwd(), "uploads");
