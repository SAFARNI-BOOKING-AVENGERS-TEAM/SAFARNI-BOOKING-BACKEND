import "dotenv/config";
import mongoose from "mongoose";
import BookingModel from "../DB/models/booking.model";
import FlightModel from "../DB/models/flight.model";
import HotelModel from "../DB/models/hotel.model";
import TourModel from "../DB/models/tour.model";

const listIndexes = async () => {
  await mongoose.connect(process.env.MONGO_URI || "");

  console.log("\n=== Booking Indexes ===");
  console.log(await BookingModel.collection.getIndexes());

  console.log("\n=== Flight Indexes ===");
  console.log(await FlightModel.collection.getIndexes());

  console.log("\n=== Hotel Indexes ===");
  console.log(await HotelModel.collection.getIndexes());

  console.log("\n=== Tour Indexes ===");
  console.log(await TourModel.collection.getIndexes());

  await mongoose.disconnect();
  process.exit(0);
};

listIndexes();