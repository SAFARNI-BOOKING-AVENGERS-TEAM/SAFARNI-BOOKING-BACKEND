// The "contract" any eSIM provider must fulfill — whether it's our
// mock implementation today, or a real provider's API (Airalo, Holafly,
// etc.) plugged in later. Nothing outside this file needs to know
// which one is actually running underneath.

export interface IESIMProfile {
  iccid: string;
  activationCode: string;
  qrCode: string;
  smdpAddress: string;
  status: "ready" | "activated" | "expired" | "suspended";
}

export interface IESIMProvider {
  provisionESIM(planId: string): Promise<IESIMProfile>;
  activateESIM(iccid: string): Promise<IESIMProfile>;
}