import mongoose from "mongoose";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI?.trim();
    if (!mongoUri) {
      throw new Error("MONGO_URI is required");
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: unknown) {
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exit(1);
  }
};

export default connectDB;
