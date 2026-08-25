import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import TourModel from "../../DB/models/tour.model";
import BookingModel from "../../DB/models/booking.model";
import ESIMPlanModel from "../../DB/models/esimPlan.model";
import ESIMOrderModel from "../../DB/models/esimOrder.model";

export const getProviderOperations = async (providerId: string) => {
  const [hotels, cars, flights, tours, esimPlans] = await Promise.all([
    HotelModel.find({ createdBy: providerId }).select("_id"),
    CarModel.find({ createdBy: providerId }).select("_id"),
    FlightModel.find({ createdBy: providerId }).select("_id"),
    TourModel.find({ createdBy: providerId }).select("_id"),
    ESIMPlanModel.find({ createdBy: providerId }).select("_id"),
  ]);

  const roomIds = (
    await RoomModel.find({ hotelId: { $in: hotels.map((hotel) => hotel._id) } }).select("_id")
  ).map((room) => room._id.toString());

  const [bookings, esimOrders] = await Promise.all([
    BookingModel.find({
      $or: [
        { category: "hotels", itemId: { $in: roomIds } },
        { category: "cars", itemId: { $in: cars.map((car) => car._id.toString()) } },
        { category: "flights", itemId: { $in: flights.map((flight) => flight._id.toString()) } },
        { category: "tours", itemId: { $in: tours.map((tour) => tour._id.toString()) } },
      ],
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean(),
    ESIMOrderModel.find({ planId: { $in: esimPlans.map((plan) => plan._id) } })
      .populate("userId", "name email")
      .populate("planId", "name country region dataAmount dataUnit validityDays")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return { bookings, esimOrders };
};
