import crypto from "crypto";
import { IESIMProvider, IESIMProfile } from "./esim.provider.interface";

// Simulates a real eSIM provisioning API. Generates realistic-looking
// (but entirely fake) ICCID/activation codes — no real telecom network
// is involved anywhere in this class.
export class MockESIMProvider implements IESIMProvider {
  async provisionESIM(planId: string): Promise<IESIMProfile> {
    // ICCIDs are typically 19-20 digits starting with 89 (telecom industry prefix)
    const iccid = "89" + crypto.randomBytes(9).toString("hex").slice(0, 18);
    const activationCode = `MOCK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    return {
      iccid,
      activationCode,
      qrCode: `mock-qr://${activationCode}`,
      smdpAddress: "smdp.mock.safarni.com",
      status: "ready",
    };
  }

  async activateESIM(iccid: string): Promise<IESIMProfile> {
    return {
      iccid,
      activationCode: `ACTIVATED-${iccid.slice(-6)}`,
      qrCode: `mock-qr://activated-${iccid}`,
      smdpAddress: "smdp.mock.safarni.com",
      status: "activated",
    };
  }
}