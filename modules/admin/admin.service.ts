import UserModel from "../../DB/models/user.model";
import HotelModel from "../../DB/models/hotel.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import TourModel from "../../DB/models/tour.model";
import PackageModel from "../../DB/models/package.model";
import {
  getBookingsByCategory,
  getRevenueByCategory,
  getBookingsByStatus,
} from "../booking/booking.service";

const countByStatus = async (model: any) => {
  const docs = await model.find().select("status");
  return {
    total: docs.length,
    pending: docs.filter((d: any) => d.status === "pending").length,
    approved: docs.filter((d: any) => d.status === "approved").length,
    rejected: docs.filter((d: any) => d.status === "rejected").length,
  };
};

export const getAdminDashboardStats = async () => {
  const [
    totalUsers,
    totalProviders,
    totalAdmins,
    hotels,
    cars,
    flights,
    tours,
    packages,
    bookingsByCategory,
    revenueByCategory,
    bookingsByStatus,
  ] = await Promise.all([
    UserModel.countDocuments({ role: "user" }),
    UserModel.countDocuments({ role: "provider" }),
    UserModel.countDocuments({ role: "admin" }),
    countByStatus(HotelModel),
    countByStatus(CarModel),
    countByStatus(FlightModel),
    countByStatus(TourModel),
    countByStatus(PackageModel),
    getBookingsByCategory(),
    getRevenueByCategory(),
    getBookingsByStatus(),
  ]);

  return {
    users: {
      total: totalUsers + totalProviders + totalAdmins,
      byRole: { user: totalUsers, provider: totalProviders, admin: totalAdmins },
    },
    services: { hotels, cars, flights, tours, packages },
    bookings: {
      byCategory: bookingsByCategory,
      byStatus: bookingsByStatus,
      revenueByCategory,
    },
  };
};