import mongoose from "mongoose";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || "");
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: unknown) {
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exit(1);
  }
};

export default connectDB;
