import CarModel from "../DB/models/car.model";

// Presentation data may use friendlier labels while the production schema keeps
// its strict enum. Normalize demo-only aliases before validation without
// changing the application schema itself.
const carTypePath = CarModel.schema.path("type") as any;
carTypePath.set((value: unknown) => value === "Compact" ? "Hatchback" : value);

void import("./seed-demo-data");
