import UserModel from "../../DB/models/user.model";
import HotelModel from "../../DB/models/hotel.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import TourModel from "../../DB/models/tour.model";
import PackageModel from "../../DB/models/package.model";
import ESIMPlanModel from "../../DB/models/esimPlan.model";
import ESIMOrderModel from "../../DB/models/esimOrder.model";
import PaymentModel from "../../DB/models/payment.model";
import BookingModel from "../../DB/models/booking.model";
import AuditLogModel from "../../DB/models/auditLog.model";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";
import {
  getBookingsByCategory,
  getRevenueByCategory,
  getBookingsByStatus,
} from "../booking/booking.service";

const SERVICE_MODELS = {
  hotels: HotelModel,
  cars: CarModel,
  flights: FlightModel,
  tours: TourModel,
  packages: PackageModel,
  esim: ESIMPlanModel,
  esimPlans: ESIMPlanModel,
} as const;

type ServiceType = keyof typeof SERVICE_MODELS;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const safeLimit = (value: unknown, fallback = 50) => Math.min(Math.max(Number(value) || fallback, 1), 100);
const safePage = (value: unknown) => Math.max(Number(value) || 1, 1);

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
      totalConfirmedRevenue: totalConfirmedRevenue[0]?.total || 0,
    },
  };
};

export const getAdminUsers = async (query: Record<string, unknown>) => {
  const page = safePage(query.page);
  const limit = safeLimit(query.limit);
  const filter: Record<string, any> = {};

  if (query.role && ["user", "provider", "admin"].includes(String(query.role))) {
    filter.role = String(query.role);
  }
  if (query.verified === "true") filter.isVerified = true;
  if (query.verified === "false") filter.isVerified = false;
  if (query.search) {
    const regex = new RegExp(escapeRegex(String(query.search)), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .select("name email role providerType isVerified profilePicture createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

export const getAdminServices = async (query: Record<string, unknown>) => {
  const requestedType = String(query.type || "all");
  const status = query.status ? String(query.status) : undefined;
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    throw new BadRequestException("Invalid service status");
  }

  const types: ServiceType[] = requestedType === "all"
    ? ["hotels", "cars", "flights", "tours", "packages", "esim"]
    : [requestedType as ServiceType];

  if (types.some((type) => !SERVICE_MODELS[type])) {
    throw new BadRequestException("Invalid service type");
  }

  const collections = await Promise.all(
    types.map(async (type) => {
      const model: any = SERVICE_MODELS[type];
      const filter = status ? { status } : {};
      const docs = await model.find(filter).sort({ createdAt: -1 }).limit(100).lean();
      return docs.map((item: any) => ({ ...item, serviceType: type === "esim" ? "esim" : type }));
    })
  );

  return collections.flat().sort((a: any, b: any) => {
    const aDate = new Date(a.createdAt || 0).getTime();
    const bDate = new Date(b.createdAt || 0).getTime();
    return bDate - aDate;
  });
};

export const updateAdminServiceStatus = async (type: string, id: string, status: string) => {
  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new BadRequestException("Status must be pending, approved, or rejected");
  }
  const model: any = SERVICE_MODELS[type as ServiceType];
  if (!model) throw new BadRequestException("Invalid service type");

  const updated = await model.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).lean();
  if (!updated) throw new NotFoundException("Service not found");
  return { ...updated, serviceType: type };
};

export const getAdminBookings = async (query: Record<string, unknown>) => {
  const page = safePage(query.page);
  const limit = safeLimit(query.limit);
  const filter: Record<string, any> = {};
  if (query.status && ["pending", "confirmed", "cancelled"].includes(String(query.status))) {
    filter.status = String(query.status);
  }
  if (query.category && ["tours", "flights", "cars", "hotels"].includes(String(query.category))) {
    filter.category = String(query.category);
  }

  const [items, total] = await Promise.all([
    BookingModel.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BookingModel.countDocuments(filter),
  ]);

  return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

export const updateAdminBookingStatus = async (id: string, status: string) => {
  if (!["pending", "confirmed", "cancelled"].includes(status)) {
    throw new BadRequestException("Invalid booking status");
  }

  if (status === "confirmed") {
    const paid = await PaymentModel.exists({ bookingId: id, status: "succeeded" });
    if (!paid) {
      throw new BadRequestException("A booking can only be confirmed after a succeeded payment");
    }
  }

  const booking = await BookingModel.findByIdAndUpdate(id, { status }, { new: true, runValidators: true })
    .populate("userId", "name email")
    .lean();
  if (!booking) throw new NotFoundException("Booking not found");
  return booking;
};

export const getAdminAuditLogs = async (query: Record<string, unknown>) => {
  const page = safePage(query.page);
  const limit = safeLimit(query.limit);
  const filter: Record<string, any> = {};
  if (query.success === "true") filter.success = true;
  if (query.success === "false") filter.success = false;
  if (query.method) filter.method = String(query.method).toUpperCase();
  if (query.search) {
    const regex = new RegExp(escapeRegex(String(query.search)), "i");
    filter.$or = [{ userEmail: regex }, { path: regex }];
  }

  const [items, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLogModel.countDocuments(filter),
  ]);

  return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};