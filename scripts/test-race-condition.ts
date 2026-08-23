import "dotenv/config";

const BASE_URL = "http://localhost:3000";

const login = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  // getSetCookie() returns each Set-Cookie header as a separate array entry —
  // avoids the comma-splitting bugs that come from treating them as one joined string
  // (cookie attributes like "Expires=Mon, 20 Jul..." contain commas themselves).
  const rawCookies = (res.headers as any).getSetCookie?.() || [];
  const cookies = rawCookies.map((c: string) => c.split(";")[0]).join("; ");

  if (!cookies) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }

  return cookies;
};

const bookRoom = async (
  cookie: string,
  roomId: string,
  startDate: string,
  endDate: string
): Promise<{ status: number; data: { message?: string } }> => {
  const res = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      category: "hotels",
      itemId: roomId,
      startDate,
      endDate,
      details: { guests: 2 },
    }),
  });
  const data = (await res.json()) as { message?: string };
  return { status: res.status, data };
};

const run = async () => {
  const roomId = process.argv[2];
  const email1 = process.argv[3];
  const password1 = process.argv[4];
  const email2 = process.argv[5];
  const password2 = process.argv[6];

  if (!roomId || !email1 || !password1 || !email2 || !password2) {
    console.error(
      "Usage: npx ts-node scripts/test-race-condition.ts <roomId> <email1> <password1> <email2> <password2>"
    );
    process.exit(1);
  }

  console.log("Logging in both users...");
  const [cookie1, cookie2] = await Promise.all([
    login(email1, password1),
    login(email2, password2),
  ]);

  const randomOffset = Math.floor(Math.random() * 5000) + 1;
  const base = new Date();
  base.setDate(base.getDate() + randomOffset);
  const endBase = new Date(base);
  endBase.setDate(endBase.getDate() + 2);

  const startDate = base.toISOString().split("T")[0];
  const endDate = endBase.toISOString().split("T")[0];

  console.log(`Testing with dates: ${startDate} to ${endDate}\n`);

  console.log("Firing both booking requests at the exact same time...\n");

  const [result1, result2] = await Promise.all([
    bookRoom(cookie1, roomId, startDate, endDate),
    bookRoom(cookie2, roomId, startDate, endDate),
  ]);

  console.log("User 1 result:", result1.status, result1.data.message);
  console.log("User 2 result:", result2.status, result2.data.message);

  const successCount = [result1, result2].filter((r) => r.status === 201).length;
  console.log(`\n=> ${successCount} out of 2 requests succeeded.`);
  console.log(successCount === 1 ? "PASS — exactly one booking succeeded." : "FAIL — expected exactly 1 success.");

  process.exit(0);
};

run();