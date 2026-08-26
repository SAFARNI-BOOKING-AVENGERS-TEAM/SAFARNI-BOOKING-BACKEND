import { ApplicationException, BadRequestException } from "../../utils/response/error.response";

type FlightIntent = {
  from: string | null;
  to: string | null;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  cabinClass: "Economy" | "Business" | "First" | "Premium_Economy";
  currency: string;
  limit: number;
  nonstopOnly: boolean;
  summary: string;
  missingFields: string[];
};

export type ExternalFlightResult = {
  rank: number;
  itineraryId: string;
  price: number;
  currency: string;
  priceStatus: string | null;
  quoteAgeMinutes: number | null;
  departure: string | null;
  arrival: string | null;
  durationMinutes: number | null;
  stops: number | null;
  airlineName: string | null;
  airlineCode: string | null;
  flightNumber: string | null;
  bookingUrl: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; data: any }>();

const getJsonText = (response: any): string | null => {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
};

const parseFlightIntentWithAI = async (prompt: string): Promise<FlightIntent> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApplicationException(
      "AI travel search is not configured. Set OPENAI_API_KEY on the backend.",
      503
    );
  }

  const model = process.env.OPENAI_SEARCH_MODEL || "gpt-5-mini";
  const today = new Date().toISOString().slice(0, 10);

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      from: { anyOf: [{ type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] },
      to: { anyOf: [{ type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] },
      departureDate: { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] },
      adults: { type: "integer", minimum: 1, maximum: 9 },
      children: { type: "integer", minimum: 0, maximum: 9 },
      infants: { type: "integer", minimum: 0, maximum: 9 },
      cabinClass: { type: "string", enum: ["Economy", "Business", "First", "Premium_Economy"] },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      limit: { type: "integer", minimum: 1, maximum: 10 },
      nonstopOnly: { type: "boolean" },
      summary: { type: "string" },
      missingFields: { type: "array", items: { type: "string" } },
    },
    required: [
      "from",
      "to",
      "departureDate",
      "adults",
      "children",
      "infants",
      "cabinClass",
      "currency",
      "limit",
      "nonstopOnly",
      "summary",
      "missingFields",
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      store: false,
      instructions:
        `You are SAFARNI's travel intent parser. Today is ${today}. ` +
        "Extract a one-way flight request into structured JSON. Resolve named cities to a major commercial airport IATA code. " +
        "Never invent an origin if the user did not provide one. Never invent a departure date if the user did not provide one. " +
        "Resolve relative dates such as next Friday using today's date. Defaults: 1 adult, 0 children, 0 infants, Economy, USD, 5 results. " +
        "Set nonstopOnly true only when the user explicitly asks for nonstop/direct flights. " +
        "Put origin, destination, or departure date in missingFields when absent. Keep summary short and user-friendly.",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "safarni_flight_search_intent",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[ai-search] OpenAI intent parsing failed: ${response.status} ${body.slice(0, 500)}`);
    throw new ApplicationException("SAFARNI AI could not understand this request right now.", 502);
  }

  const data = await response.json();
  const jsonText = getJsonText(data);
  if (!jsonText) {
    throw new ApplicationException("SAFARNI AI returned an empty search interpretation.", 502);
  }

  let parsed: FlightIntent;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ApplicationException("SAFARNI AI returned an invalid search interpretation.", 502);
  }

  parsed.from = parsed.from?.toUpperCase() || null;
  parsed.to = parsed.to?.toUpperCase() || null;
  parsed.currency = (parsed.currency || "USD").toUpperCase();
  parsed.limit = Math.min(Math.max(Number(parsed.limit) || 5, 1), 10);

  if (parsed.departureDate && parsed.departureDate < today) {
    parsed.missingFields = Array.from(new Set([...parsed.missingFields, "future departure date"]));
    parsed.departureDate = null;
  }

  return parsed;
};

const getSafeBookingUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://www.skyscanner.com");
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const normalizeResults = (raw: any, intent: FlightIntent): ExternalFlightResult[] => {
  const rows: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.results)
        ? raw.results
        : [];

  const normalized: ExternalFlightResult[] = rows
    .map<ExternalFlightResult | null>((row: any) => {
      const firstSegment = Array.isArray(row?.segments) ? row.segments[0] : null;
      const carrier = firstSegment?.marketing_carrier || null;
      const price = Number(row?.price);
      if (!Number.isFinite(price) || price <= 0) return null;

      const stops = row?.stops == null ? null : Number(row.stops);
      return {
        rank: 0,
        itineraryId: String(row?.itinerary_id || row?.itineraryId || ""),
        price,
        currency: String(row?.currency || intent.currency || "USD").toUpperCase(),
        priceStatus: row?.price_status == null ? null : String(row.price_status),
        quoteAgeMinutes: Number.isFinite(Number(row?.quote_age_minutes)) ? Number(row.quote_age_minutes) : null,
        departure: typeof row?.departure === "string" ? row.departure : null,
        arrival: typeof row?.arrival === "string" ? row.arrival : null,
        durationMinutes: Number.isFinite(Number(row?.duration_minutes)) ? Number(row.duration_minutes) : null,
        stops: stops !== null && Number.isFinite(stops) ? stops : null,
        airlineName:
          typeof carrier?.name === "string"
            ? carrier.name
            : typeof carrier?.display_name === "string"
              ? carrier.display_name
              : null,
        airlineCode:
          typeof carrier?.display_code === "string"
            ? carrier.display_code
            : typeof carrier?.code === "string"
              ? carrier.code
              : null,
        flightNumber: firstSegment?.flight_number == null ? null : String(firstSegment.flight_number),
        bookingUrl: getSafeBookingUrl(row?.booking_url),
      };
    })
    .filter((item: ExternalFlightResult | null): item is ExternalFlightResult => item !== null);

  const filtered: ExternalFlightResult[] = intent.nonstopOnly
    ? normalized.filter((flight: ExternalFlightResult) => flight.stops === 0)
    : normalized;

  return filtered
    .sort((a: ExternalFlightResult, b: ExternalFlightResult) => a.price - b.price)
    .slice(0, intent.limit)
    .map((flight: ExternalFlightResult, index: number) => ({ ...flight, rank: index + 1 }));
};

const searchN8n = async (intent: FlightIntent) => {
  const webhook = process.env.N8N_FLIGHT_SEARCH_WEBHOOK_URL;
  if (!webhook) {
    throw new ApplicationException(
      "Live flight search is not configured. Set N8N_FLIGHT_SEARCH_WEBHOOK_URL on the backend.",
      503
    );
  }

  if (!intent.from || !intent.to || !intent.departureDate) {
    throw new BadRequestException("Origin, destination, and departure date are required before searching flights.");
  }

  const url = new URL(webhook);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new ApplicationException("The n8n flight-search webhook must use HTTPS in production.", 500);
  }

  url.searchParams.set("from", intent.from);
  url.searchParams.set("to", intent.to);
  url.searchParams.set("date", intent.departureDate);
  url.searchParams.set("nadults", String(intent.adults));
  url.searchParams.set("nchilds", String(intent.children));
  url.searchParams.set("ninfants", String(intent.infants));
  url.searchParams.set("class", intent.cabinClass);
  url.searchParams.set("currency", intent.currency);
  url.searchParams.set("limit", String(intent.limit));
  url.searchParams.set("nonstop", String(intent.nonstopOnly));

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["x-safarni-webhook-secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(65_000),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[ai-search] n8n flight search failed: ${response.status} ${body.slice(0, 500)}`);
    throw new ApplicationException("The live flight provider could not complete this search.", 502);
  }

  return await response.json();
};

export const searchFlightsFromPrompt = async (prompt: string) => {
  const intent = await parseFlightIntentWithAI(prompt);

  if (intent.missingFields.length || !intent.from || !intent.to || !intent.departureDate) {
    return {
      status: "needs_input" as const,
      intent,
      results: [] as ExternalFlightResult[],
      source: "FlightAPI via n8n",
      cached: false,
    };
  }

  const cacheKey = JSON.stringify({
    from: intent.from,
    to: intent.to,
    departureDate: intent.departureDate,
    adults: intent.adults,
    children: intent.children,
    infants: intent.infants,
    cabinClass: intent.cabinClass,
    currency: intent.currency,
    limit: intent.limit,
    nonstopOnly: intent.nonstopOnly,
  });

  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const rawResults = await searchN8n(intent);
  const results = normalizeResults(rawResults, intent);

  const data = {
    status: "results" as const,
    intent,
    results,
    source: "FlightAPI via n8n",
    cached: false,
    searchedAt: new Date().toISOString(),
  };

  searchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data });
  return data;
};

export const getAISearchDiagnostics = () => ({
  aiConfigured: Boolean(process.env.OPENAI_API_KEY),
  aiModel: process.env.OPENAI_SEARCH_MODEL || "gpt-5-mini",
  n8nConfigured: Boolean(process.env.N8N_FLIGHT_SEARCH_WEBHOOK_URL),
  webhookSecretConfigured: Boolean(process.env.N8N_WEBHOOK_SECRET),
  cacheTtlSeconds: CACHE_TTL_MS / 1000,
});
