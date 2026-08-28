import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../DB/connect";
import UserModel from "../DB/models/user.model";
import HotelModel from "../DB/models/hotel.model";
import RoomModel from "../DB/models/room.model";
import CarModel from "../DB/models/car.model";
import FlightModel from "../DB/models/flight.model";
import TourModel from "../DB/models/tour.model";
import PackageModel from "../DB/models/package.model";
import ESIMPlanModel from "../DB/models/esimPlan.model";
import ESIMOrderModel from "../DB/models/esimOrder.model";
import BookingModel from "../DB/models/booking.model";
import PaymentModel from "../DB/models/payment.model";
import FavoriteModel from "../DB/models/favorite.model";
import NotificationModel from "../DB/models/notification.model";
import AuditLogModel from "../DB/models/auditLog.model";
import { hashString } from "../utils/security/hash.security";

const PASSWORD = process.env.SEED_TEST_PASSWORD || "SafarniTest123!";
const DEMO_EMAIL_RE = /@safarni\.demo$/i;

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

const futureDate = (days: number, hour = 10) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const pastDate = (days: number, hour = 10) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const assertSafeDatabase = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data while NODE_ENV=production");
  }

  const uri = process.env.MONGO_URI || "";
  if (!uri) throw new Error("MONGO_URI is required before running the demo seed");
  const looksLocal = /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(uri);
  if (!looksLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error("Refusing to seed a non-local MongoDB without ALLOW_REMOTE_SEED=true");
  }
};

async function main() {
  assertSafeDatabase();
  await connectDB();

  const [traveler, admin, travelProvider, telecomProvider, bothProvider] = await Promise.all([
    UserModel.findOne({ email: "traveler@safarni.test" }),
    UserModel.findOne({ email: "admin@safarni.test" }),
    UserModel.findOne({ email: "travel.provider@safarni.test" }),
    UserModel.findOne({ email: "telecom.provider@safarni.test" }),
    UserModel.findOne({ email: "both.provider@safarni.test" }),
  ]);

  if (!traveler || !admin || !travelProvider || !telecomProvider || !bothProvider) {
    throw new Error("Run npm run seed:test first. Base SAFARNI seed accounts were not found.");
  }

  // Clean only presentation-layer fixtures from a previous demo seed run.
  const oldDemoUsers = await UserModel.find({ email: DEMO_EMAIL_RE }).select("_id");
  const oldDemoUserIds = oldDemoUsers.map((user) => user._id);
  await Promise.all([
    BookingModel.deleteMany({ userId: { $in: oldDemoUserIds } }),
    PaymentModel.deleteMany({ $or: [{ userId: { $in: oldDemoUserIds } }, { stripePaymentIntentId: /^demo_seed:/ }] }),
    ESIMOrderModel.deleteMany({ userId: { $in: oldDemoUserIds } }),
    FavoriteModel.deleteMany({ userId: { $in: oldDemoUserIds } }),
    NotificationModel.deleteMany({ userId: { $in: oldDemoUserIds } }),
    AuditLogModel.deleteMany({ userEmail: DEMO_EMAIL_RE }),
  ]);
  await UserModel.deleteMany({ _id: { $in: oldDemoUserIds } });

  // seed:test deletes the base traveler's payments, but keep this idempotent when this script is run alone.
  await PaymentModel.deleteMany({ userId: traveler._id, stripePaymentIntentId: /^demo_seed:/ });
  await ESIMOrderModel.deleteMany({ userId: traveler._id, "profile.iccid": /^890000DEMO/ });
  await AuditLogModel.deleteMany({ path: /^\/demo-seed\// });

  const passwordHash = await hashString(PASSWORD);
  const demoUsers = await UserModel.create([
    { name: "Omar Hassan", email: "omar.hassan@safarni.demo", password: passwordHash, role: "user", isVerified: true },
    { name: "Lina Mahmoud", email: "lina.mahmoud@safarni.demo", password: passwordHash, role: "user", isVerified: true },
    { name: "Youssef Adel", email: "youssef.adel@safarni.demo", password: passwordHash, role: "user", isVerified: true },
    { name: "Nour Khaled", email: "nour.khaled@safarni.demo", password: passwordHash, role: "user", isVerified: true },
    { name: "Sara Ibrahim", email: "sara.ibrahim@safarni.demo", password: passwordHash, role: "user", isVerified: true },
    { name: "Adam Mostafa", email: "adam.mostafa@safarni.demo", password: passwordHash, role: "user", isVerified: true },
  ]);

  // ----- Enrich public inventory -----
  const demoHotels = await HotelModel.create([
    {
      name: "Royal Nile Luxor Hotel",
      description: "Elegant riverside stay in Luxor with sunset terraces, spacious rooms, and easy access to Karnak and the West Bank.",
      rating: 4.7,
      location: { city: "Luxor", address: "Khaled Ibn El Walid Street, Luxor", lat: 25.6872, lng: 32.6396 },
      amenities: ["Nile view", "Pool", "Breakfast", "Spa", "Airport transfer"],
      gallery: [
        { url: image("photo-1564501049412-61c2a3083791"), publicId: "seed/demo-luxor-1" },
        { url: image("photo-1542314831-068cd1dbfeeb"), publicId: "seed/demo-luxor-2" },
      ],
      policies: { checkIn: "14:00", checkOut: "12:00", cancellation: "Free cancellation up to 48 hours before arrival" },
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
    {
      name: "Coral Bay Sharm Resort",
      description: "Premium Red Sea resort with reef access, beach cabanas, diving activities, and a relaxed family-friendly atmosphere.",
      rating: 4.9,
      location: { city: "Sharm El Sheikh", address: "Sharks Bay, Sharm El Sheikh", lat: 27.977, lng: 34.394 },
      amenities: ["Private beach", "House reef", "Pool", "Kids club", "All-day dining"],
      gallery: [
        { url: image("photo-1571896349842-33c89424de2d"), publicId: "seed/demo-sharm-1" },
        { url: image("photo-1540541338287-41700207dee6"), publicId: "seed/demo-sharm-2" },
      ],
      policies: { checkIn: "15:00", checkOut: "11:00", cancellation: "Flexible cancellation up to 72 hours before arrival" },
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
    {
      name: "Dubai Marina Skyline Hotel",
      description: "Contemporary Dubai Marina hotel with skyline views, rooftop pool, and quick access to JBR and the Metro.",
      rating: 4.6,
      location: { city: "Dubai", address: "Dubai Marina, UAE", lat: 25.08, lng: 55.14 },
      amenities: ["Rooftop pool", "Gym", "Wi-Fi", "Marina view", "Metro shuttle"],
      gallery: [
        { url: image("photo-1512453979798-5ea266f8880c"), publicId: "seed/demo-dubai-1" },
        { url: image("photo-1566665797739-1674de7a421a"), publicId: "seed/demo-dubai-2" },
      ],
      policies: { checkIn: "15:00", checkOut: "12:00", cancellation: "Free cancellation up to 3 days before arrival" },
      createdBy: bothProvider._id,
      updatedBy: bothProvider._id,
      status: "approved",
    },
  ]);

  const demoRooms = await RoomModel.create([
    { hotelId: demoHotels[0]._id, name: "Nile Balcony King", occupancy: { adults: 2, children: 1 }, pricePerNight: 155, refundable: true, amenities: ["Nile balcony", "King bed", "Breakfast"] },
    { hotelId: demoHotels[0]._id, name: "Royal Family Suite", occupancy: { adults: 3, children: 2 }, pricePerNight: 285, refundable: true, amenities: ["Two bedrooms", "Living room", "Nile view"] },
    { hotelId: demoHotels[1]._id, name: "Coral Sea View Room", occupancy: { adults: 2, children: 2 }, pricePerNight: 175, refundable: true, amenities: ["Sea view", "Balcony", "Breakfast"] },
    { hotelId: demoHotels[1]._id, name: "Family Beach Suite", occupancy: { adults: 2, children: 3 }, pricePerNight: 310, refundable: true, amenities: ["Two bedrooms", "Beach access", "Kids club"] },
    { hotelId: demoHotels[2]._id, name: "Marina Skyline Room", occupancy: { adults: 2, children: 1 }, pricePerNight: 220, refundable: true, amenities: ["Marina view", "King bed", "Smart TV"] },
    { hotelId: demoHotels[2]._id, name: "Executive Marina Suite", occupancy: { adults: 3, children: 1 }, pricePerNight: 390, refundable: false, amenities: ["Living room", "Skyline view", "Lounge access"] },
  ]);

  const demoCars = await CarModel.create([
    { brand: "Nissan", model: "Sunny", year: 2025, type: "Sedan", transmission: "Automatic", fuelType: "Petrol", seats: 5, pricePerDay: 38, available: true, location: { city: "Cairo", address: "Cairo International Airport" }, image: image("photo-1552519507-da3b142c6e3d"), createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved" },
    { brand: "BMW", model: "X3", year: 2025, type: "SUV", transmission: "Automatic", fuelType: "Petrol", seats: 5, pricePerDay: 145, available: true, location: { city: "Cairo", address: "New Cairo" }, image: image("photo-1555215695-3004980ad54e"), createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
    { brand: "Toyota", model: "Land Cruiser", year: 2026, type: "SUV", transmission: "Automatic", fuelType: "Petrol", seats: 7, pricePerDay: 165, available: true, location: { city: "Dubai", address: "Dubai International Airport" }, image: image("photo-1533473359331-0135ef1b58bf"), createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
    { brand: "Mini", model: "Cooper", year: 2025, type: "Compact", transmission: "Automatic", fuelType: "Petrol", seats: 4, pricePerDay: 78, available: true, location: { city: "Alexandria", address: "Corniche Pickup Point" }, image: image("photo-1532581140115-3e355d1ed1de"), createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved" },
  ]);

  const demoFlights = await FlightModel.create([
    { airline: "EgyptAir", flightNumber: "MS799", departureAirport: "CAI", arrivalAirport: "CDG", departureTime: futureDate(16, 9), arrivalTime: futureDate(16, 14), price: 345, availableSeats: 31, class: "Economy", createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved" },
    { airline: "Turkish Airlines", flightNumber: "TK695", departureAirport: "CAI", arrivalAirport: "IST", departureTime: futureDate(19, 5), arrivalTime: futureDate(19, 8), price: 265, availableSeats: 24, class: "Economy", createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
    { airline: "Qatar Airways", flightNumber: "QR1306", departureAirport: "CAI", arrivalAirport: "DOH", departureTime: futureDate(21, 13), arrivalTime: futureDate(21, 17), price: 395, availableSeats: 18, class: "Economy", createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
    { airline: "Air France", flightNumber: "AF551", departureAirport: "CDG", arrivalAirport: "CAI", departureTime: futureDate(35, 11), arrivalTime: futureDate(35, 16), price: 520, availableSeats: 8, class: "Business", createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved" },
  ]);

  const demoTours = await TourModel.create([
    {
      title: "Cairo Nile Dinner Cruise",
      slug: "demo-cairo-nile-dinner-cruise",
      summary: "An evening Nile cruise with dinner, live entertainment, and Cairo skyline views.",
      fullDescription: "Enjoy hotel pickup, a two-hour Nile cruise, buffet dinner, live music, and traditional entertainment in a relaxed evening setting.",
      mainImage: image("photo-1548013146-72479768bada"),
      gallery: [image("photo-1539650116574-75c0c6d73f6e")],
      startDates: [{ date: futureDate(5, 18), capacity: 30 }, { date: futureDate(12, 18), capacity: 30 }],
      duration: "3 hours",
      highlights: ["Nile sunset", "Dinner buffet", "Live entertainment"],
      activities: ["Cruise", "Dinner", "Live show"],
      locations: [{ name: "Nile Corniche", country: "Egypt", city: "Cairo" }],
      priceTiers: [{ type: "Adult", price: 58 }, { type: "Child", price: 35 }],
      inclusiveItems: ["Hotel pickup", "Cruise", "Dinner"],
      exclusiveItems: ["Drinks", "Personal expenses"],
      cancellationPolicy: "Free cancellation up to 24 hours before departure",
      languages: ["English", "Arabic"],
      difficulty: "Easy",
      providerInfo: { name: "NileGate Travel", contact: "support@nilegate.test" },
      reviews: [
        { userId: demoUsers[0]._id, rating: 5, comment: "Great views and a very smooth evening experience." },
        { userId: demoUsers[1]._id, rating: 4, comment: "Lovely atmosphere and friendly staff." },
      ],
      tags: ["cairo", "nile", "evening"],
      recommended: true,
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
    {
      title: "Ras Mohammed Snorkeling Adventure",
      slug: "demo-ras-mohammed-snorkeling",
      summary: "Full-day boat trip from Sharm El Sheikh with snorkeling stops in Ras Mohammed National Park.",
      fullDescription: "Cruise to clear-water snorkeling sites with equipment, lunch, guide support, and multiple reef stops.",
      mainImage: image("photo-1544551763-46a013bb70d5"),
      gallery: [image("photo-1530789253388-582c481c54b0")],
      startDates: [{ date: futureDate(9, 8), capacity: 22 }, { date: futureDate(16, 8), capacity: 22 }],
      duration: "8 hours",
      highlights: ["Ras Mohammed", "Coral reefs", "Three snorkeling stops"],
      activities: ["Snorkeling", "Boat trip", "Swimming"],
      locations: [{ name: "Ras Mohammed", country: "Egypt", city: "Sharm El Sheikh" }],
      priceTiers: [{ type: "Adult", price: 72 }, { type: "Child", price: 45 }],
      inclusiveItems: ["Boat", "Lunch", "Snorkeling equipment"],
      exclusiveItems: ["National park fee", "Underwater photos"],
      cancellationPolicy: "Free cancellation up to 48 hours before departure",
      languages: ["English", "Arabic", "Russian"],
      difficulty: "Easy",
      providerInfo: { name: "NileGate Travel" },
      reviews: [
        { userId: demoUsers[2]._id, rating: 5, comment: "The water was incredible and the crew was excellent." },
        { userId: demoUsers[3]._id, rating: 5, comment: "One of the best activities in Sharm." },
      ],
      tags: ["sea", "snorkeling", "sharm"],
      recommended: true,
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
    {
      title: "Abu Simbel Sunrise Journey",
      slug: "demo-abu-simbel-sunrise",
      summary: "Early-morning guided journey from Aswan to the monumental Abu Simbel temples.",
      fullDescription: "Travel comfortably before sunrise, explore both temples with a licensed guide, and return to Aswan by early afternoon.",
      mainImage: image("photo-1603523009205-5b0bb6c5c5e2"),
      gallery: [],
      startDates: [{ date: futureDate(28, 4), capacity: 16 }],
      duration: "9 hours",
      highlights: ["Temple of Ramses II", "Temple of Nefertari", "Lake Nasser"],
      activities: ["History", "Guided tour", "Photography"],
      locations: [{ name: "Abu Simbel", country: "Egypt", city: "Aswan" }],
      priceTiers: [{ type: "Adult", price: 135 }],
      inclusiveItems: ["Transport", "Guide", "Water"],
      exclusiveItems: ["Entry ticket", "Breakfast"],
      cancellationPolicy: "48-hour cancellation",
      languages: ["English", "Arabic", "French"],
      difficulty: "Moderate",
      providerInfo: { name: "VoyageConnect" },
      reviews: [{ userId: demoUsers[4]._id, rating: 5, comment: "Worth the early start. The temples are unforgettable." }],
      tags: ["aswan", "history", "temples"],
      recommended: true,
      createdBy: bothProvider._id,
      updatedBy: bothProvider._id,
      status: "approved",
    },
  ]);

  const baseHotel = await HotelModel.findOne({ name: "Nile View Grand Hotel" });
  const baseCar = await CarModel.findOne({ brand: "Toyota", model: "Corolla" });
  const baseTour = await TourModel.findOne({ slug: "seed-pyramids-gem-day-tour" });
  const baseFlight = await FlightModel.findOne({ flightNumber: "SF1002" });
  if (!baseHotel || !baseCar || !baseTour || !baseFlight) throw new Error("Base demo services are missing");

  const demoPackages = await PackageModel.create([
    {
      title: "Luxury Nile Discovery",
      description: "A premium Cairo-to-Luxor escape combining a riverside hotel, private car, and unforgettable history experiences.",
      coverImage: image("photo-1539650116574-75c0c6d73f6e"),
      gallery: [],
      country: "Egypt",
      cities: ["Cairo", "Luxor"],
      tags: ["luxury", "history", "nile"],
      packageType: "couples",
      durationLabel: "6 days / 5 nights",
      items: [
        { category: "hotels", itemId: demoHotels[0]._id.toString(), order: 1 },
        { category: "cars", itemId: demoCars[1]._id.toString(), order: 2 },
        { category: "tours", itemId: demoTours[2]._id.toString(), order: 3 },
      ],
      discountPercentage: 18,
      estimatedOriginalPrice: 1680,
      featured: true,
      validUntil: futureDate(180),
      sourceType: "curated",
      createdBy: bothProvider._id,
      updatedBy: bothProvider._id,
      status: "approved",
    },
    {
      title: "Sharm Sun & Sea Escape",
      description: "Five days of beach time, snorkeling, and flexible transport in Sharm El Sheikh.",
      coverImage: image("photo-1544551763-46a013bb70d5"),
      gallery: [],
      country: "Egypt",
      cities: ["Sharm El Sheikh"],
      tags: ["beach", "snorkeling", "relaxation"],
      packageType: "family",
      durationLabel: "5 days / 4 nights",
      items: [
        { category: "hotels", itemId: demoHotels[1]._id.toString(), order: 1 },
        { category: "tours", itemId: demoTours[1]._id.toString(), order: 2 },
        { category: "cars", itemId: demoCars[0]._id.toString(), order: 3 },
      ],
      discountPercentage: 14,
      estimatedOriginalPrice: 1180,
      featured: true,
      validUntil: futureDate(150),
      sourceType: "provider",
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
  ]);

  const demoEsimPlans = await ESIMPlanModel.create([
    { name: "France City 10GB", country: "France", region: "Europe", dataAmount: 10, dataUnit: "GB", validityDays: 20, price: 19, currency: "USD", createdBy: telecomProvider._id, updatedBy: telecomProvider._id, status: "approved" },
    { name: "Global Traveler 25GB", country: "Global", region: "Global", dataAmount: 25, dataUnit: "GB", validityDays: 30, price: 49, currency: "USD", createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
  ]);

  // ----- Customer demo history -----
  const confirmedTravelerBookings = await BookingModel.create([
    {
      userId: traveler._id,
      category: "hotels",
      itemId: demoRooms[2]._id.toString(),
      startDate: futureDate(6),
      endDate: futureDate(10),
      totalPrice: demoRooms[2].pricePerNight * 4,
      status: "confirmed",
      details: { hotelId: demoHotels[1]._id.toString(), roomName: demoRooms[2].name, guests: 2 },
    },
    {
      userId: traveler._id,
      category: "flights",
      itemId: demoFlights[0]._id.toString(),
      startDate: demoFlights[0].departureTime,
      endDate: demoFlights[0].arrivalTime,
      totalPrice: demoFlights[0].price,
      status: "confirmed",
      details: { passengers: 1, class: demoFlights[0].class },
    },
    {
      userId: traveler._id,
      category: "cars",
      itemId: demoCars[0]._id.toString(),
      startDate: futureDate(6),
      endDate: futureDate(9),
      totalPrice: demoCars[0].pricePerDay * 3,
      status: "confirmed",
      details: { pickupCity: "Cairo" },
    },
  ]);

  const packageBookingId = `DEMO-PKG-${Date.now()}`;
  const packageChildren = await BookingModel.create([
    { userId: traveler._id, category: "hotels", itemId: demoRooms[0]._id.toString(), packageBookingId, startDate: futureDate(42), endDate: futureDate(45), totalPrice: 381.3, status: "confirmed", details: { packageTitle: demoPackages[0].title } },
    { userId: traveler._id, category: "cars", itemId: demoCars[1]._id.toString(), packageBookingId, startDate: futureDate(42), endDate: futureDate(45), totalPrice: 356.7, status: "confirmed", details: { packageTitle: demoPackages[0].title } },
    { userId: traveler._id, category: "tours", itemId: demoTours[2]._id.toString(), packageBookingId, startDate: futureDate(44), endDate: futureDate(44, 19), totalPrice: 110.7, status: "confirmed", details: { packageTitle: demoPackages[0].title } },
  ]);

  const travelerPayments = await PaymentModel.create([
    { userId: traveler._id, bookingId: confirmedTravelerBookings[0]._id.toString(), amount: confirmedTravelerBookings[0].totalPrice, currency: "usd", stripePaymentIntentId: "demo_seed:traveler:hotel", status: "succeeded" },
    { userId: traveler._id, bookingId: confirmedTravelerBookings[1]._id.toString(), amount: confirmedTravelerBookings[1].totalPrice, currency: "usd", stripePaymentIntentId: "demo_seed:traveler:flight", status: "succeeded" },
    { userId: traveler._id, bookingId: confirmedTravelerBookings[2]._id.toString(), amount: confirmedTravelerBookings[2].totalPrice, currency: "usd", stripePaymentIntentId: "demo_seed:traveler:car", status: "succeeded" },
    { userId: traveler._id, packageBookingId, amount: packageChildren.reduce((sum, booking) => sum + booking.totalPrice, 0), currency: "usd", stripePaymentIntentId: "demo_seed:traveler:package", status: "succeeded" },
  ]);

  const completedEsim = await ESIMOrderModel.create({
    userId: traveler._id,
    planId: demoEsimPlans[0]._id,
    planSnapshot: { name: demoEsimPlans[0].name, country: demoEsimPlans[0].country, region: demoEsimPlans[0].region, dataAmount: demoEsimPlans[0].dataAmount, dataUnit: demoEsimPlans[0].dataUnit, validityDays: demoEsimPlans[0].validityDays },
    status: "completed",
    price: demoEsimPlans[0].price,
    currency: demoEsimPlans[0].currency,
    profile: {
      iccid: "890000DEMO000001",
      activationCode: "LPA:1$demo.smdp.safarni.com$FRANCE-DEMO-001",
      qrCode: "mock-qr://FRANCE-DEMO-001",
      smdpAddress: "demo.smdp.safarni.com",
      status: "ready",
      expiresAt: futureDate(20),
    },
  });

  const activatedEsim = await ESIMOrderModel.create({
    userId: traveler._id,
    planId: demoEsimPlans[1]._id,
    planSnapshot: { name: demoEsimPlans[1].name, country: demoEsimPlans[1].country, region: demoEsimPlans[1].region, dataAmount: demoEsimPlans[1].dataAmount, dataUnit: demoEsimPlans[1].dataUnit, validityDays: demoEsimPlans[1].validityDays },
    status: "completed",
    price: demoEsimPlans[1].price,
    currency: demoEsimPlans[1].currency,
    profile: {
      iccid: "890000DEMO000002",
      activationCode: "LPA:1$demo.smdp.safarni.com$GLOBAL-DEMO-002",
      qrCode: "mock-qr://GLOBAL-DEMO-002",
      smdpAddress: "demo.smdp.safarni.com",
      status: "activated",
      expiresAt: futureDate(28),
    },
  });

  await PaymentModel.create([
    { userId: traveler._id, esimOrderId: completedEsim._id.toString(), amount: completedEsim.price, currency: "usd", stripePaymentIntentId: "demo_seed:traveler:esim-ready", status: "succeeded" },
    { userId: traveler._id, esimOrderId: activatedEsim._id.toString(), amount: activatedEsim.price, currency: "usd", stripePaymentIntentId: "demo_seed:traveler:esim-activated", status: "succeeded" },
  ]);

  await FavoriteModel.create([
    { userId: traveler._id, category: "hotels", itemId: demoHotels[1]._id.toString() },
    { userId: traveler._id, category: "cars", itemId: demoCars[1]._id.toString() },
    { userId: traveler._id, category: "tours", itemId: demoTours[0]._id.toString() },
    { userId: traveler._id, category: "tours", itemId: demoTours[1]._id.toString() },
  ]);

  await NotificationModel.create([
    { userId: traveler._id, title: "Payment successful", message: "Your Coral Bay Sharm Resort stay is confirmed.", type: "booking_status_changed", isRead: false, relatedId: confirmedTravelerBookings[0]._id.toString() },
    { userId: traveler._id, title: "Flight confirmed", message: "Your Cairo to Paris flight is confirmed and ready for your trip.", type: "booking_status_changed", isRead: false, relatedId: confirmedTravelerBookings[1]._id.toString() },
    { userId: traveler._id, title: "eSIM ready", message: "Your France City 10GB eSIM is ready to install and activate.", type: "booking_status_changed", isRead: false, relatedId: completedEsim._id.toString() },
    { userId: traveler._id, title: "Package confirmed", message: "Your Luxury Nile Discovery package is fully confirmed.", type: "booking_status_changed", isRead: true, relatedId: packageBookingId },
    { userId: traveler._id, title: "Welcome back", message: "You have new featured packages and travel deals waiting for you.", type: "booking_created", isRead: true },
  ]);

  // ----- Provider/admin activity -----
  const providerBookings: any[] = [];
  const providerPayments: any[] = [];
  const providerBookingSpecs = [
    { user: demoUsers[0], category: "hotels", itemId: demoRooms[0]._id.toString(), start: futureDate(14), end: futureDate(17), amount: 465, status: "confirmed" },
    { user: demoUsers[1], category: "tours", itemId: demoTours[0]._id.toString(), start: futureDate(7), end: futureDate(7, 21), amount: 116, status: "confirmed" },
    { user: demoUsers[2], category: "cars", itemId: demoCars[1]._id.toString(), start: futureDate(11), end: futureDate(15), amount: 580, status: "confirmed" },
    { user: demoUsers[3], category: "flights", itemId: demoFlights[2]._id.toString(), start: demoFlights[2].departureTime, end: demoFlights[2].arrivalTime, amount: 395, status: "confirmed" },
    { user: demoUsers[4], category: "hotels", itemId: demoRooms[4]._id.toString(), start: futureDate(30), end: futureDate(33), amount: 660, status: "pending" },
    { user: demoUsers[5], category: "tours", itemId: demoTours[1]._id.toString(), start: futureDate(16), end: futureDate(16, 18), amount: 144, status: "cancelled" },
  ];

  for (const spec of providerBookingSpecs) {
    const booking = await BookingModel.create({
      userId: spec.user._id,
      category: spec.category,
      itemId: spec.itemId,
      startDate: spec.start,
      endDate: spec.end,
      totalPrice: spec.amount,
      status: spec.status,
      details: { demo: true },
    });
    providerBookings.push(booking);
    if (spec.status === "confirmed") {
      providerPayments.push(await PaymentModel.create({
        userId: spec.user._id,
        bookingId: booking._id.toString(),
        amount: spec.amount,
        currency: "usd",
        stripePaymentIntentId: `demo_seed:provider:${booking._id.toString()}`,
        status: "succeeded",
      }));
    }
  }

  const providerEsimOrder = await ESIMOrderModel.create({
    userId: demoUsers[1]._id,
    planId: demoEsimPlans[1]._id,
    planSnapshot: { name: demoEsimPlans[1].name, country: demoEsimPlans[1].country, region: demoEsimPlans[1].region, dataAmount: demoEsimPlans[1].dataAmount, dataUnit: demoEsimPlans[1].dataUnit, validityDays: demoEsimPlans[1].validityDays },
    status: "completed",
    price: demoEsimPlans[1].price,
    currency: demoEsimPlans[1].currency,
    profile: { iccid: "890000DEMO000003", activationCode: "LPA:1$demo.smdp.safarni.com$GLOBAL-DEMO-003", qrCode: "mock-qr://GLOBAL-DEMO-003", smdpAddress: "demo.smdp.safarni.com", status: "activated", expiresAt: futureDate(25) },
  });
  await PaymentModel.create({ userId: demoUsers[1]._id, esimOrderId: providerEsimOrder._id.toString(), amount: providerEsimOrder.price, currency: "usd", stripePaymentIntentId: "demo_seed:provider:esim", status: "succeeded" });

  await NotificationModel.create([
    { userId: travelProvider._id, title: "New confirmed booking", message: "A customer confirmed a Royal Nile Luxor Hotel reservation.", type: "booking_created", isRead: false, relatedId: providerBookings[0]._id.toString() },
    { userId: travelProvider._id, title: "New tour booking", message: "Cairo Nile Dinner Cruise received a new confirmed booking.", type: "booking_created", isRead: false, relatedId: providerBookings[1]._id.toString() },
    { userId: bothProvider._id, title: "New rental booking", message: "BMW X3 received a confirmed four-day booking.", type: "booking_created", isRead: true, relatedId: providerBookings[2]._id.toString() },
    { userId: telecomProvider._id, title: "eSIM order completed", message: "A Global Traveler 25GB order was provisioned successfully.", type: "booking_status_changed", isRead: false, relatedId: providerEsimOrder._id.toString() },
  ]);

  const auditRows = [
    { userId: admin._id, userEmail: "admin@safarni.test", method: "PATCH", path: "/demo-seed/admin/services/hotel/status", statusCode: 200, success: true, createdAt: pastDate(1, 9) },
    { userId: admin._id, userEmail: "admin@safarni.test", method: "GET", path: "/demo-seed/admin/dashboard/stats", statusCode: 200, success: true, createdAt: pastDate(1, 10) },
    { userId: travelProvider._id, userEmail: "travel.provider@safarni.test", method: "POST", path: "/demo-seed/hotels", statusCode: 201, success: true, createdAt: pastDate(2, 11) },
    { userId: travelProvider._id, userEmail: "travel.provider@safarni.test", method: "PATCH", path: "/demo-seed/tours/demo-cairo-nile-dinner-cruise", statusCode: 200, success: true, createdAt: pastDate(2, 14) },
    { userId: telecomProvider._id, userEmail: "telecom.provider@safarni.test", method: "POST", path: "/demo-seed/esim/plans", statusCode: 201, success: true, createdAt: pastDate(3, 12) },
    { userId: traveler._id, userEmail: "traveler@safarni.test", method: "POST", path: "/demo-seed/payments/checkout-session", statusCode: 201, success: true, createdAt: pastDate(4, 18) },
    { userId: demoUsers[0]._id, userEmail: demoUsers[0].email, method: "POST", path: "/demo-seed/bookings", statusCode: 201, success: true, createdAt: pastDate(5, 10) },
    { userId: demoUsers[1]._id, userEmail: demoUsers[1].email, method: "POST", path: "/demo-seed/esim/orders", statusCode: 201, success: true, createdAt: pastDate(5, 15) },
    { userId: demoUsers[2]._id, userEmail: demoUsers[2].email, method: "POST", path: "/demo-seed/favorites", statusCode: 201, success: true, createdAt: pastDate(6, 16) },
    { userId: demoUsers[3]._id, userEmail: demoUsers[3].email, method: "GET", path: "/demo-seed/flights", statusCode: 200, success: true, createdAt: pastDate(7, 8) },
    { userEmail: "anonymous", method: "POST", path: "/demo-seed/auth/login", statusCode: 401, success: false, createdAt: pastDate(7, 20) },
    { userId: admin._id, userEmail: "admin@safarni.test", method: "GET", path: "/demo-seed/admin/audit-logs", statusCode: 200, success: true, createdAt: new Date() },
  ];
  await AuditLogModel.insertMany(auditRows);

  const totals = {
    demoUsers: demoUsers.length,
    addedHotels: demoHotels.length,
    addedRooms: demoRooms.length,
    addedCars: demoCars.length,
    addedFlights: demoFlights.length,
    addedTours: demoTours.length,
    addedPackages: demoPackages.length,
    addedEsimPlans: demoEsimPlans.length,
    confirmedTravelerBookings: confirmedTravelerBookings.length + packageChildren.length,
    providerBookings: providerBookings.length,
    syntheticSucceededPayments: travelerPayments.length + 2 + providerPayments.length + 1,
  };

  console.log("\nSAFARNI presentation demo data added successfully.\n");
  console.table(totals);
  console.log("Demo payments use demo_seed:* identifiers. They populate dashboards only and are not real Stripe transactions.");
  console.log("Main demo login: traveler@safarni.test /", PASSWORD);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
