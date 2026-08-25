import "dotenv/config";
import mongoose from "mongoose";
import UserModel from "../DB/models/user.model";

const makeAdmin = async () => {
  const email = process.argv[2];

  if (!email) {
    console.error("Please provide an email. Example:");
    console.error("   npx ts-node scripts/make-admin.ts user@example.com");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || "");

  const user = await UserModel.findOneAndUpdate(
    { email },
    { role: "admin" },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email: ${email}`);
  } else {
    console.log(`${user.email} is now an admin (role: ${user.role})`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

makeAdmin();