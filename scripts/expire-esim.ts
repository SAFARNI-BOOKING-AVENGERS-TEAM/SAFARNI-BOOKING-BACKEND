import "dotenv/config";
import mongoose from "mongoose";
import ESIMOrderModel from "../DB/models/esimOrder.model";

const expireESIM = async () => {
  const orderId = process.argv[2];

  if (!orderId) {
    console.error("Usage: npx ts-node scripts/expire-esim.ts <orderId>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || "");

  const order = await ESIMOrderModel.findById(orderId);
  if (!order || !order.profile) {
    console.error("Order not found or has no profile yet.");
    process.exit(1);
  }

  order.profile.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past
  await order.save();

  console.log(`✅ Order ${orderId} profile.expiresAt set to the past.`);

  await mongoose.disconnect();
  process.exit(0);
};

expireESIM();