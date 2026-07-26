import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import TourModel from "../../DB/models/tour.model";
import BookingModel from "../../DB/models/booking.model";

const countByStatus = (docs: any[]) => ({
  total: docs.length,
  pending: docs.filter((d) => d.status === "pending").length,
  approved: docs.filter((d) => d.status === "approved").length,
  rejected: docs.filter((d) => d.status === "rejected").length,
});

export const getProviderDashboardStats = async (providerId: string) => {
  const [hotels, cars, flights, tours] = await Promise.all([
    HotelModel.find({ createdBy: providerId }),
    CarModel.find({ createdBy: providerId }),
    FlightModel.find({ createdBy: providerId }),
    TourModel.find({ createdBy: providerId }),
  ]);

  const hotelIds = hotels.map((h) => h._id.toString());
  const roomIds = (
    await RoomModel.find({ hotelId: { $in: hotelIds } }).select("_id")
  ).map((r) => r._id.toString());
  const carIds = cars.map((c) => c._id.toString());
  const flightIds = flights.map((f) => f._id.toString());
  const tourIds = tours.map((t) => t._id.toString());

  const bookings = await BookingModel.find({
    $or: [
      { category: "hotels", itemId: { $in: roomIds } },
      { category: "cars", itemId: { $in: carIds } },
      { category: "flights", itemId: { $in: flightIds } },
      { category: "tours", itemId: { $in: tourIds } },
    ],
  });

  const totalRevenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return {
    services: {
      hotels: countByStatus(hotels),
      cars: countByStatus(cars),
      flights: countByStatus(flights),
      tours: countByStatus(tours),
    },
    bookings: {
      total: bookings.length,
      totalRevenue,
      byStatus: {
        pending: bookings.filter((b) => b.status === "pending").length,
        confirmed: bookings.filter((b) => b.status === "confirmed").length,
        cancelled: bookings.filter((b) => b.status === "cancelled").length,
      },
    },
  };
};