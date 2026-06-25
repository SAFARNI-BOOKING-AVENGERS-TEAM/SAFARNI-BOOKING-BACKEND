import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";

export class HotelService {
    // get All hotels with filters
    static async getHotels(queryParam: any = {}) {
      const { city, name, rating } = queryParam;
      const query: any = {};
  
      if (city) {
        query["location.city"] = { $regex: city, $options: "i" };
      }
      if (name) {
        query.name = { $regex: name, $options: "i" };
      }
      if (rating) {
        query.rating = { $gte: Number(rating) };
      }
  
      return await HotelModel.find(query);
    }
  // get hotel by id 
    static async getHotelDetails(hotelId: string) {
      const hotel = await HotelModel.findById(hotelId);
  
      if (!hotel) {
        throw new Error("Hotel not found");
      }
  
      const rooms = await RoomModel.find({ hotelId });
  
      return {
        hotel,
        rooms
      };
    }

    // create hotel 
    static async createHotel(payload: any) {
      const {
        name,
        description,
        rating,
        location,
        amenities,
        policies
      } = payload;
  
      
      if (!name || !location?.city) {
        throw new Error("Hotel name and city are required");
      }
  
      const hotel = await HotelModel.create({
        name,
        description,
        rating,
        location,
        amenities,
        policies,
        gallery: []
      });
  
      return hotel;
    }
    static async createRoom(hotelId: string, payload: any) {
      const hotel = await HotelModel.findById(hotelId);
      if (!hotel) {
        throw new Error("Hotel not found");
      }
  
      const {
        name,
        occupancy,
        pricePerNight,
        refundable,
        amenities
      } = payload;
  
      if (!name || !occupancy?.adults || !pricePerNight) {
        throw new Error("Room name, occupancy and price are required");
      }
  
      const room = await RoomModel.create({
        hotelId,
        name,
        occupancy,
        pricePerNight,
        refundable,
        amenities
      });
  
      return room;
    }

    static async addHotelImages(hotelId: string, images: any[]) {
      const hotel = await HotelModel.findById(hotelId);
      if (!hotel) throw new Error("Hotel not found");
  
      const gallery = images.map(img => ({
        url: img.path,
        publicId: img.filename
      }));
  
      hotel.gallery.push(...gallery);
      await hotel.save();
  
      return hotel.gallery;
    }

    static async updateRoom(roomId: string, payload: any) {
      const room = await RoomModel.findById(roomId);
      if (!room) {
        throw new Error("Room not found");
      }

      Object.assign(room, payload);
      await room.save();
      return room;
    }

    static async deleteRoom(roomId: string) {
      const room = await RoomModel.findByIdAndDelete(roomId);
      if (!room) {
        throw new Error("Room not found");
      }
      return room;
    }
}