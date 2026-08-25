import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import TourModel from "../../DB/models/tour.model";
import BookingModel from "../../DB/models/booking.model";
import ESIMPlanModel from "../../DB/models/esimPlan.model";
import ESIMOrderModel from "../../DB/models/esimOrder.model";

const countByStatus = (docs: any[]) => ({
  total: docs.length,
  pending: docs.filter((doc) => doc.status === "pending").length,
  approved: docs.filter((doc) => doc.status === "approved").length,
  rejected: docs.filter((doc) => doc.status === "rejected").length,
});

export const getProviderDashboardStats = async (providerId: string) => {
  const [hotels, cars, flights, tours, esimPlans] = await Promise.all([
    HotelModel.find({ createdBy: providerId }),
    CarModel.find({ createdBy: providerId }),
    FlightModel.find({ createdBy: providerId }),
    TourModel.find({ createdBy: providerId }),
    ESIMPlanModel.find({ createdBy: providerId }),
  ]);

  const hotelIds = hotels.map((hotel) => hotel._id.toString());
  const roomIds = (
    await RoomModel.find({ hotelId: { $in: hotelIds } }).select("_id")
  ).map((room) => room._id.toString());
  const carIds = cars.map((car) => car._id.toString());
  const flightIds = flights.map((flight) => flight._id.toString());
  const tourIds = tours.map((tour) => tour._id.toString());
  const esimPlanIds = esimPlans.map((plan) => plan._id);

  const [bookings, esimOrders] = await Promise.all([
    BookingModel.find({
      $or: [
        { category: "hotels", itemId: { $in: roomIds } },
        { category: "cars", itemId: { $in: carIds } },
        { category: "flights", itemId: { $in: flightIds } },
        { category: "tours", itemId: { $in: tourIds } },
      ],
    }),
    ESIMOrderModel.find({ planId: { $in: esimPlanIds } }),
  ]);

  const travelRevenue = bookings
    .filter((booking) => booking.status === "confirmed")
    .reduce((sum, booking) => sum + booking.totalPrice, 0);

  // Under the hardened eSIM flow an order reaches completed only after Stripe
  // succeeds and provisioning completes, so completed-order revenue is paid revenue.
  const esimRevenue = esimOrders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + order.price, 0);

  return {
    services: {
      hotels: countByStatus(hotels),
      cars: countByStatus(cars),
      flights: countByStatus(flights),
      tours: countByStatus(tours),
      esimPlans: countByStatus(esimPlans),
    },
    bookings: {
      total: bookings.length,
      totalRevenue: travelRevenue,
      byStatus: {
        pending: bookings.filter((booking) => booking.status === "pending").length,
        confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
        cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
      },
    },
    esim: {
      totalOrders: esimOrders.length,
      completedOrders: esimOrders.filter((order) => order.status === "completed").length,
      pendingOrders: esimOrders.filter((order) => ["pending", "processing"].includes(order.status)).length,
      failedOrders: esimOrders.filter((order) => order.status === "failed").length,
      revenue: esimRevenue,
    },
    revenue: {
      travel: travelRevenue,
      esim: esimRevenue,
      total: travelRevenue + esimRevenue,
    },
  };
};
