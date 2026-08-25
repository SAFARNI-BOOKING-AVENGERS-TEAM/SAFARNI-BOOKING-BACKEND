import { IESIMProvider } from "./esim.provider.interface";
import { MockESIMProvider } from "./mock-esim.provider";

// Single place that decides which provider implementation is active.
// Swapping to a real provider later means adding one line here —
// nothing else in the codebase (Service, Controller) needs to change,
// because everything only ever talks to the IESIMProvider interface.
export const getESIMProvider = (): IESIMProvider => {
  // future: if (process.env.ESIM_PROVIDER === "real") return new RealESIMProvider();
  return new MockESIMProvider();
};