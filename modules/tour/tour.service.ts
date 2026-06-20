import Tour, { ITour } from "../../DB/models/tour.model";

export const createTour = async (data: Partial<ITour>): Promise<ITour> => {
  return await Tour.create(data);
};

export const getTours = async (query: any = {}): Promise<ITour[]> => {
  return await Tour.find(query);
};

export const getTourById = async (id: string): Promise<ITour | null> => {
  return await Tour.findById(id);
};

export const updateTour = async (
  id: string,
  data: Partial<ITour>
): Promise<ITour | null> => {
  return await Tour.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

export const deleteTour = async (id: string): Promise<ITour | null> => {
  return await Tour.findByIdAndDelete(id);
};