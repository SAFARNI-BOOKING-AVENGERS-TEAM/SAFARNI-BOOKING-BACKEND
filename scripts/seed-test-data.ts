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

const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || "SafarniTest123!";
const SEED_EMAILS = {
  admin: "admin@safarni.test",
  traveler: "traveler@safarni.test",
  travelProvider: "travel.provider@safarni.test",
  telecomProvider: "telecom.provider@safarni.test",
  bothProvider: "both.provider@safarni.test",
};

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

const futureDate = (days: number, hour = 10) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const assertSafeDatabase = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed while NODE_ENV=production");
  }

  const uri = process.env.MONGO_URI || "";
  if (!uri) throw new Error("MONGO_URI is required before running the seed");

  const looksLocal = /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(uri);
  if (!looksLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error(
      "Refusing to seed a non-local MongoDB. Set ALLOW_REMOTE_SEED=true only for a dedicated test database."
    );
  }
};

async function main() {
  assertSafeDatabase();
  await connectDB();

  const passwordHash = await hashString(TEST_PASSWORD);

  const upsertUser = async (
    email: string,
    data: { name: string; role: "user" | "provider" | "admin"; providerType?: "travel" | "telecom" | "both" }
  ) => {
    const $unset: Record<string, string> = {
      emailVerificationToken: "",
      emailVerificationExpires: "",
      passwordResetToken: "",
      passwordResetExpires: "",
    };
    if (data.role !== "provider") $unset.providerType = "";

    return await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          name: data.name,
          email,
          password: passwordHash,
          role: data.role,
          ...(data.providerType ? { providerType: data.providerType } : {}),
          isVerified: true,
          refreshTokenVersion: 0,
        },
        $unset,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  };

  const admin = await upsertUser(SEED_EMAILS.admin, { name: "SAFARNI Test Admin", role: "admin" });
  const traveler = await upsertUser(SEED_EMAILS.traveler, { name: "Mariam Test Traveler", role: "user" });
  const travelProvider = await upsertUser(SEED_EMAILS.travelProvider, {
    name: "NileGate Travel",
    role: "provider",
    providerType: "travel",
  });
  const telecomProvider = await upsertUser(SEED_EMAILS.telecomProvider, {
    name: "RoamLink Telecom",
    role: "provider",
    providerType: "telecom",
  });
  const bothProvider = await upsertUser(SEED_EMAILS.bothProvider, {
    name: "VoyageConnect",
    role: "provider",
    providerType: "both",
  });

  const providerIds = [travelProvider._id, telecomProvider._id, bothProvider._id];
  const oldHotels = await HotelModel.find({ createdBy: { $in: providerIds } }).select("_id");
  const oldHotelIds = oldHotels.map((hotel) => hotel._id);

  await Promise.all([
    RoomModel.deleteMany({ hotelId: { $in: oldHotelIds } }),
    HotelModel.deleteMany({ createdBy: { $in: providerIds } }),
    CarModel.deleteMany({ createdBy: { $in: providerIds } }),
    FlightModel.deleteMany({ createdBy: { $in: providerIds } }),
    TourModel.deleteMany({ createdBy: { $in: providerIds } }),
    PackageModel.deleteMany({ createdBy: { $in: providerIds } }),
    ESIMPlanModel.deleteMany({ createdBy: { $in: providerIds } }),
    BookingModel.deleteMany({ userId: traveler._id }),
    PaymentModel.deleteMany({ userId: traveler._id }),
    ESIMOrderModel.deleteMany({ userId: traveler._id }),
    FavoriteModel.deleteMany({ userId: traveler._id }),
    NotificationModel.deleteMany({ userId: { $in: [traveler._id, ...providerIds] } }),
    AuditLogModel.deleteMany({ userEmail: { $in: Object.values(SEED_EMAILS) } }),
  ]);

  const hotels = await HotelModel.create([
    {
      name: "Nile View Grand Hotel",
      description: "Five-star stay overlooking the Nile with rooftop dining and central Cairo access.",
      rating: 4.8,
      location: { city: "Cairo", address: "Garden City, Cairo", lat: 30.034, lng: 31.231 },
      amenities: ["Wi-Fi", "Pool", "Breakfast", "Gym", "Airport transfer"],
      gallery: [
        { url: image("photo-1566073771259-6a8506099945"), publicId: "seed/nile-view-1" },
        { url: image("photo-1551882547-ff40c63fe5fa"), publicId: "seed/nile-view-2" },
      ],
      policies: { checkIn: "14:00", checkOut: "12:00", cancellation: "Free cancellation up to 48 hours before arrival" },
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
    {
      name: "Red Sea Marina Resort",
      description: "Beachfront Hurghada resort with private beach, diving desk, spa, and family facilities.",
      rating: 4.6,
      location: { city: "Hurghada", address: "Marina Boulevard, Hurghada", lat: 27.257, lng: 33.812 },
      amenities: ["Private beach", "Pool", "Spa", "Wi-Fi", "Diving center"],
      gallery: [{ url: image("photo-1582719478250-c89cae4dc85b"), publicId: "seed/red-sea-1" }],
      policies: { checkIn: "15:00", checkOut: "11:00", cancellation: "Flexible cancellation up to 72 hours before arrival" },
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "approved",
    },
    {
      name: "Alexandria Corniche Boutique",
      description: "Boutique Mediterranean hotel submitted by a provider and waiting for admin review.",
      rating: 4.2,
      location: { city: "Alexandria", address: "Corniche Road, Alexandria" },
      amenities: ["Sea view", "Wi-Fi", "Breakfast"],
      gallery: [{ url: image("photo-1455587734955-081b22074882"), publicId: "seed/alex-pending" }],
      policies: { checkIn: "14:00", checkOut: "12:00", cancellation: "Non-refundable within 24 hours" },
      createdBy: travelProvider._id,
      updatedBy: travelProvider._id,
      status: "pending",
    },
  ]);

  const rooms = await RoomModel.create([
    { hotelId: hotels[0]._id, name: "Deluxe Nile Room", occupancy: { adults: 2, children: 1 }, pricePerNight: 145, refundable: true, amenities: ["Nile view", "King bed", "Breakfast"] },
    { hotelId: hotels[0]._id, name: "Executive Suite", occupancy: { adults: 3, children: 1 }, pricePerNight: 265, refundable: true, amenities: ["Living area", "Nile view", "Lounge access"] },
    { hotelId: hotels[1]._id, name: "Sea View Double", occupancy: { adults: 2, children: 2 }, pricePerNight: 120, refundable: true, amenities: ["Sea view", "Balcony", "Breakfast"] },
    { hotelId: hotels[1]._id, name: "Family Beach Suite", occupancy: { adults: 2, children: 3 }, pricePerNight: 210, refundable: false, amenities: ["Two bedrooms", "Beach access", "Kids club"] },
  ]);

  const cars = await CarModel.create([
    {
      brand: "Toyota", model: "Corolla", year: 2025, type: "Sedan", transmission: "Automatic", fuelType: "Petrol",
      seats: 5, pricePerDay: 45, available: true, location: { city: "Cairo", address: "Cairo International Airport" },
      image: image("photo-1549317661-bd32c8ce0db2"), createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      brand: "Hyundai", model: "Tucson", year: 2025, type: "SUV", transmission: "Automatic", fuelType: "Hybrid",
      seats: 5, pricePerDay: 72, available: true, location: { city: "Giza", address: "Dokki, Giza" },
      image: image("photo-1502877338535-766e1452684a"), createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      brand: "Mercedes-Benz", model: "E-Class", year: 2026, type: "Luxury", transmission: "Automatic", fuelType: "Petrol",
      seats: 5, pricePerDay: 135, available: true, location: { city: "Cairo", address: "New Cairo" },
      image: image("photo-1563720223185-11003d516935"), createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved",
    },
    {
      brand: "Kia", model: "Sportage", year: 2024, type: "SUV", transmission: "Automatic", fuelType: "Petrol",
      seats: 5, pricePerDay: 62, available: true, location: { city: "Alexandria", address: "Borg El Arab Airport" },
      image: image("photo-1492144534655-ae79c964c9d7"), createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "pending",
    },
    {
      brand: "Fiat", model: "Tipo", year: 2022, type: "Sedan", transmission: "Manual", fuelType: "Petrol",
      seats: 5, pricePerDay: 32, available: false, location: { city: "Cairo", address: "Nasr City" },
      image: image("photo-1550355291-bbee04a92027"), createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "rejected",
    },
  ]);

  const flights = await FlightModel.create([
    {
      airline: "EgyptAir", flightNumber: "SF1001", departureAirport: "CAI", arrivalAirport: "DXB",
      departureTime: futureDate(18, 7), arrivalTime: futureDate(18, 11), price: 285, availableSeats: 42, class: "Economy",
      createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      airline: "Nile Air", flightNumber: "SF1002", departureAirport: "CAI", arrivalAirport: "HRG",
      departureTime: futureDate(12, 9), arrivalTime: futureDate(12, 10), price: 95, availableSeats: 28, class: "Economy",
      createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      airline: "Emirates", flightNumber: "SF1003", departureAirport: "DXB", arrivalAirport: "CAI",
      departureTime: futureDate(25, 14), arrivalTime: futureDate(25, 18), price: 610, availableSeats: 12, class: "Business",
      createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved",
    },
    {
      airline: "Air Cairo", flightNumber: "SF1004", departureAirport: "CAI", arrivalAirport: "SSH",
      departureTime: futureDate(30, 6), arrivalTime: futureDate(30, 7), price: 110, availableSeats: 50, class: "Economy",
      createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "pending",
    },
  ]);

  const tours = await TourModel.create([
    {
      title: "Pyramids, Sphinx & GEM Day Tour", slug: "seed-pyramids-gem-day-tour",
      summary: "A full-day guided Cairo experience covering Giza, the Sphinx, and the Grand Egyptian Museum.",
      fullDescription: "Private transport, licensed guide, flexible photo stops, and a balanced itinerary for first-time Cairo visitors.",
      mainImage: image("photo-1539650116574-75c0c6d73f6e"), gallery: [image("photo-1568322445389-f64ac2515020")],
      startDates: [{ date: futureDate(8), capacity: 18 }, { date: futureDate(15), capacity: 18 }], duration: "8 hours",
      highlights: ["Giza Pyramids", "Great Sphinx", "Grand Egyptian Museum"], activities: ["Guided tour", "Photography", "Museum visit"],
      locations: [{ name: "Giza Plateau", country: "Egypt", city: "Giza" }],
      priceTiers: [{ type: "Adult", price: 85 }, { type: "Child", price: 45 }], inclusiveItems: ["Private transport", "Guide", "Water"],
      exclusiveItems: ["Lunch", "Personal expenses"], cancellationPolicy: "Free cancellation up to 24 hours before departure",
      languages: ["English", "Arabic"], difficulty: "Easy", providerInfo: { name: "NileGate Travel", contact: "support@nilegate.test" },
      reviews: [], tags: ["culture", "cairo", "pyramids"], recommended: true, createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      title: "Luxor East & West Bank Explorer", slug: "seed-luxor-east-west-bank",
      summary: "Temples, tombs, and Nile-side history in one carefully paced Luxor day.",
      fullDescription: "Visit Karnak, Luxor Temple, Valley of the Kings, and Hatshepsut Temple with an Egyptologist guide.",
      mainImage: image("photo-1568322445389-f64ac2515020"), gallery: [],
      startDates: [{ date: futureDate(22), capacity: 14 }], duration: "10 hours",
      highlights: ["Karnak Temple", "Valley of the Kings", "Hatshepsut Temple"], activities: ["History", "Guided tour"],
      locations: [{ name: "Luxor", country: "Egypt", city: "Luxor" }], priceTiers: [{ type: "Adult", price: 120 }],
      inclusiveItems: ["Guide", "Hotel pickup"], exclusiveItems: ["Entry tickets", "Lunch"], cancellationPolicy: "48-hour cancellation",
      languages: ["English", "Arabic", "French"], difficulty: "Moderate", providerInfo: { name: "NileGate Travel" }, reviews: [],
      tags: ["luxor", "history"], recommended: true, createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      title: "Siwa Desert Camp Weekend", slug: "seed-siwa-desert-weekend",
      summary: "A provider-submitted desert escape currently waiting for admin moderation.",
      mainImage: image("photo-1500530855697-b586d89ba3ee"), startDates: [{ date: futureDate(40), capacity: 10 }], duration: "3 days / 2 nights",
      locations: [{ name: "Siwa Oasis", country: "Egypt", city: "Siwa" }], priceTiers: [{ type: "Per person", price: 260 }],
      languages: ["English", "Arabic"], providerInfo: { name: "NileGate Travel" }, reviews: [], tags: ["desert", "adventure"], recommended: false,
      createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "pending",
    },
    {
      title: "Old Cairo Night Walk", slug: "seed-old-cairo-night-walk",
      summary: "A rejected sample listing retained specifically for moderation-state testing.",
      mainImage: image("photo-1572252009286-268acec5ca0a"), startDates: [{ date: futureDate(10), capacity: 20 }], duration: "3 hours",
      locations: [{ name: "Old Cairo", country: "Egypt", city: "Cairo" }], priceTiers: [{ type: "Adult", price: 35 }], languages: ["English"],
      providerInfo: { name: "NileGate Travel" }, reviews: [], tags: ["cairo", "walking"], recommended: false,
      createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "rejected",
    },
  ]);

  const packages = await PackageModel.create([
    {
      title: "Cairo Essentials Escape", description: "Hotel, private car, and iconic Cairo sightseeing bundled for a simple first visit.",
      coverImage: image("photo-1572252009286-268acec5ca0a"), gallery: [], country: "Egypt", cities: ["Cairo", "Giza"], tags: ["culture", "city-break"],
      packageType: "couples", durationLabel: "4 days / 3 nights",
      items: [
        { category: "hotels", itemId: hotels[0]._id.toString(), order: 1 },
        { category: "cars", itemId: cars[0]._id.toString(), order: 2 },
        { category: "tours", itemId: tours[0]._id.toString(), order: 3 },
      ],
      discountPercentage: 12, estimatedOriginalPrice: 720, featured: true, validUntil: futureDate(120), sourceType: "curated",
      createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved",
    },
    {
      title: "Red Sea Family Week", description: "Family resort stay, SUV rental, and domestic flight for an easy Hurghada holiday.",
      coverImage: image("photo-1582719478250-c89cae4dc85b"), gallery: [], country: "Egypt", cities: ["Cairo", "Hurghada"], tags: ["family", "beach"],
      packageType: "family", durationLabel: "7 days / 6 nights",
      items: [
        { category: "hotels", itemId: hotels[1]._id.toString(), order: 1 },
        { category: "flights", itemId: flights[1]._id.toString(), order: 2 },
        { category: "cars", itemId: cars[1]._id.toString(), order: 3 },
      ],
      discountPercentage: 15, estimatedOriginalPrice: 1250, featured: true, validUntil: futureDate(150), sourceType: "provider",
      createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "approved",
    },
    {
      title: "Siwa Adventure Bundle", description: "Pending provider package for testing the admin approval queue.",
      coverImage: image("photo-1500530855697-b586d89ba3ee"), gallery: [], country: "Egypt", cities: ["Siwa"], tags: ["adventure", "desert"],
      packageType: "adventure", durationLabel: "4 days / 3 nights",
      items: [{ category: "tours", itemId: tours[2]._id.toString(), order: 1 }], discountPercentage: 10, estimatedOriginalPrice: 420,
      featured: false, validUntil: futureDate(180), sourceType: "provider", createdBy: travelProvider._id, updatedBy: travelProvider._id, status: "pending",
    },
  ]);

  const esimPlans = await ESIMPlanModel.create([
    { name: "Egypt Traveler 5GB", country: "Egypt", region: "Africa", dataAmount: 5, dataUnit: "GB", validityDays: 15, price: 12, currency: "USD", createdBy: telecomProvider._id, updatedBy: telecomProvider._id, status: "approved" },
    { name: "Egypt Explorer 20GB", country: "Egypt", region: "Africa", dataAmount: 20, dataUnit: "GB", validityDays: 30, price: 29, currency: "USD", createdBy: telecomProvider._id, updatedBy: telecomProvider._id, status: "approved" },
    { name: "UAE City Break 10GB", country: "United Arab Emirates", region: "Middle East", dataAmount: 10, dataUnit: "GB", validityDays: 15, price: 18, currency: "USD", createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
    { name: "Europe Multi-Country 15GB", country: "Europe", region: "Europe", dataAmount: 15, dataUnit: "GB", validityDays: 30, price: 34, currency: "USD", createdBy: bothProvider._id, updatedBy: bothProvider._id, status: "approved" },
    { name: "Saudi Weekend 3GB", country: "Saudi Arabia", region: "Middle East", dataAmount: 3, dataUnit: "GB", validityDays: 7, price: 10, currency: "USD", createdBy: telecomProvider._id, updatedBy: telecomProvider._id, status: "pending" },
    { name: "Legacy Egypt 1GB", country: "Egypt", region: "Africa", dataAmount: 1, dataUnit: "GB", validityDays: 7, price: 5, currency: "USD", createdBy: telecomProvider._id, updatedBy: telecomProvider._id, status: "rejected" },
  ]);

  const bookings = await BookingModel.create([
    {
      userId: traveler._id, category: "hotels", itemId: rooms[0]._id.toString(), startDate: futureDate(10), endDate: futureDate(13),
      totalPrice: rooms[0].pricePerNight * 3, status: "pending", details: { hotelId: hotels[0]._id.toString(), roomName: rooms[0].name, guests: 2 },
    },
    {
      userId: traveler._id, category: "cars", itemId: cars[1]._id.toString(), startDate: futureDate(20), endDate: futureDate(24),
      totalPrice: cars[1].pricePerDay * 4, status: "pending", details: { pickupCity: "Giza" },
    },
    {
      userId: traveler._id, category: "tours", itemId: tours[0]._id.toString(), startDate: futureDate(15), endDate: futureDate(15, 18),
      totalPrice: 170, status: "cancelled", details: { guests: 2 },
    },
    {
      userId: traveler._id, category: "flights", itemId: flights[0]._id.toString(), startDate: flights[0].departureTime, endDate: flights[0].arrivalTime,
      totalPrice: flights[0].price, status: "pending", details: { passengers: 1, class: flights[0].class },
    },
  ]);

  await FavoriteModel.create([
    { userId: traveler._id, category: "hotels", itemId: hotels[0]._id.toString() },
    { userId: traveler._id, category: "cars", itemId: cars[1]._id.toString() },
    { userId: traveler._id, category: "tours", itemId: tours[1]._id.toString() },
  ]);

  await NotificationModel.create([
    { userId: traveler._id, title: "Booking created", message: "Your Nile View Grand Hotel booking is waiting for payment.", type: "booking_created", isRead: false, relatedId: bookings[0]._id.toString() },
    { userId: traveler._id, title: "Trip reminder", message: "Your upcoming test flight is ready for payment and confirmation.", type: "booking_status_changed", isRead: true, relatedId: bookings[3]._id.toString() },
    { userId: travelProvider._id, title: "Listing awaiting review", message: "Alexandria Corniche Boutique is pending admin review.", type: "service_rejected", isRead: false, relatedId: hotels[2]._id.toString() },
  ]);

  await ESIMOrderModel.create([
    {
      userId: traveler._id, planId: esimPlans[0]._id, status: "completed", price: esimPlans[0].price, currency: esimPlans[0].currency,
      profile: {
        iccid: "8900000000000000001", activationCode: "LPA:1$mock.smdp.safarni.test$SEED-EGYPT-001",
        qrCode: "SEED-QR-EGYPT-001", smdpAddress: "mock.smdp.safarni.test", status: "ready", expiresAt: futureDate(15),
      },
    },
    { userId: traveler._id, planId: esimPlans[2]._id, status: "pending", price: esimPlans[2].price, currency: esimPlans[2].currency },
  ]);

  console.log("\nSAFARNI test data seeded successfully.\n");
  console.table({
    admin: SEED_EMAILS.admin,
    traveler: SEED_EMAILS.traveler,
    travelProvider: SEED_EMAILS.travelProvider,
    telecomProvider: SEED_EMAILS.telecomProvider,
    bothProvider: SEED_EMAILS.bothProvider,
    password: TEST_PASSWORD,
  });
  console.table({
    hotels: hotels.length,
    rooms: rooms.length,
    cars: cars.length,
    flights: flights.length,
    tours: tours.length,
    packages: packages.length,
    esimPlans: esimPlans.length,
    bookings: bookings.length,
    payments: 0,
  });
  console.log("Stripe success fixtures were intentionally NOT created. Use the real Stripe test flow to create succeeded payments.\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
