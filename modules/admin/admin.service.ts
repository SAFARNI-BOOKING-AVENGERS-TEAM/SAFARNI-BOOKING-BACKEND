import UserModel from "../../DB/models/user.model";
import HotelModel from "../../DB/models/hotel.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import TourModel from "../../DB/models/tour.model";
import PackageModel from "../../DB/models/package.model";
import ESIMPlanModel from "../../DB/models/esimPlan.model";
import ESIMOrderModel from "../../DB/models/esimOrder.model";
import PaymentModel from "../../DB/models/payment.model";
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
    esimPlans,
    bookingsByCategory,
    revenueByCategory,
    bookingsByStatus,
    totalConfirmedRevenue,
    esimOrdersCount,
    esimOrdersRevenue,
  ] = await Promise.all([
    UserModel.countDocuments({ role: "user" }),
    UserModel.countDocuments({ role: "provider" }),
    UserModel.countDocuments({ role: "admin" }),
    countByStatus(HotelModel),
    countByStatus(CarModel),
    countByStatus(FlightModel),
    countByStatus(TourModel),
    countByStatus(PackageModel),
    countByStatus(ESIMPlanModel),
    getBookingsByCategory(),
    getRevenueByCategory(),
    getBookingsByStatus(),
    PaymentModel.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ESIMOrderModel.countDocuments({ status: "completed" }),
    ESIMOrderModel.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
  ]);

  return {
    users: {
      total: totalUsers + totalProviders + totalAdmins,
      byRole: { user: totalUsers, provider: totalProviders, admin: totalAdmins },
    },
    services: { hotels, cars, flights, tours, packages, esimPlans },
    bookings: {
      byCategory: bookingsByCategory,
      byStatus: bookingsByStatus,
      revenueByCategory,
    },
    esim: {
      completedOrders: esimOrdersCount,
      revenue: esimOrdersRevenue[0]?.total || 0,
    },
    payments: {
      // The real, Stripe-verified total — independent of how bookings were confirmed
      totalConfirmedRevenue: totalConfirmedRevenue[0]?.total || 0,
    },
  };
};