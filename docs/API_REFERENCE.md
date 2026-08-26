# SAFARNI Backend API Reference

**Verification basis:** current `security/hardening-v1` backend implementation, reviewed from `app.ts`, `routes/index.ts`, module controllers, authentication middleware, service guards, and Zod request schemas.

**Purpose:** this file is an implementation-grounded API inventory for graduation documentation, Postman coverage, frontend integration review, and future OpenAPI generation. It documents only routes that exist in the codebase. It does not claim a production deployment URL.

## 1. API overview

- Local backend default: `http://localhost:5000`
- API style: REST-oriented Express + TypeScript
- Data store: MongoDB through Mongoose
- Canonical route operations documented here: **96**
- Additional mounted aliases: **16** operations because the complete hotel and flight routers are also mounted at `/api/hotels` and `/api/flights`
- Protected endpoints authenticate with the `access_token` HTTP-only cookie.
- Session refresh uses the `refresh_token` HTTP-only cookie.
- CORS is configured with credentials enabled and the configured `FRONTEND_URL` as the allowed origin.

### Authentication cookie behavior

The server sets `access_token` and `refresh_token` as `httpOnly` cookies with `SameSite=Lax`. Cookies are marked `Secure` when `NODE_ENV=production`. The access token cookie lasts 24 hours in development and 1 hour otherwise; the refresh token cookie lasts 7 days.

For browser clients, authenticated API calls therefore need credentials enabled (for example, Axios `withCredentials: true` or Fetch `credentials: "include"`). The current authentication middleware does **not** read an `Authorization: Bearer ...` header.

### Access legend

| Label | Meaning |
|---|---|
| Public | No authenticated session required |
| Optional Auth | Publicly callable; authenticated identity may change visibility/results |
| Authenticated | Valid access-token cookie required |
| Provider | Authenticated user with role `provider` |
| Admin | Authenticated user with role `admin` |
| Travel Provider | Provider with `providerType=travel` or `both` |
| Telecom Provider | Provider with `providerType=telecom` or `both` |
| Owner/Admin | Service layer enforces resource ownership unless the caller is admin |

## 2. Routing map

The main router mounts these prefixes:

`/auth`, `/tours`, `/hotels`, `/api/hotels`, `/bookings`, `/cars`, `/flights`, `/api/flights`, `/notifications`, `/favorites`, `/packages`, `/users`, `/admin`, `/provider`, `/esim`, `/payments`, `/ai-search`.

Stripe webhooks are mounted separately under `/webhooks` so the `/webhooks/stripe` request body can remain raw for Stripe signature verification.

> `/api/hotels` is a complete alias of `/hotels`, and `/api/flights` is a complete alias of `/flights`. This means their protected/admin sub-routes are duplicated too; the same middleware still protects those aliases.

## 3. System/root endpoint

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | Public | API status/metadata response including service name, version, environment, categories, actors, feature summary and route map |

This endpoint is also used by the Kubernetes backend readiness/liveness probes.

## 4. Authentication and service-provider administration

All `/auth/*` routes pass through the authentication-specific rate limiter mounted in `routes/index.ts`. In production its limit is 10 requests per 15 minutes per IP.

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| POST | `/auth/forgot-password/request` | Public | `{ email }`; returns a generic response whether or not the account exists |
| POST | `/auth/forgot-password/confirm/:token` | Public | `{ password, confirmPassword }`; token must be at least 32 chars; passwords must match |
| POST | `/auth/signup` | Public | `{ name, email, password }`; creates an unverified user and sends verification email |
| POST | `/auth/login` | Public | `{ email, password }`; verified accounts only; sets access + refresh cookies |
| POST | `/auth/refresh-token` | Public with refresh cookie | Rotates refresh-token version and sets new token cookies |
| POST | `/auth/logout` | Public/session-aware | Revokes current refresh-token version when possible and clears token cookies |
| POST | `/auth/verify-email/:token` | Public | Verifies email using hashed expiring token |
| POST | `/auth/service-providers` | Admin | `{ name, email, password, providerType }`; provider type is `travel`, `telecom`, or `both` |
| GET | `/auth/service-providers` | Admin | Lists provider users; optional `providerType` query filter |
| GET | `/auth/service-providers/:id` | Admin | Gets one provider account |
| PUT | `/auth/service-providers/:id` | Admin | Full update: `{ name, email, providerType }` |
| PATCH | `/auth/service-providers/:id` | Admin | Partial update of `name`, `email`, and/or `providerType`; at least one field required |
| DELETE | `/auth/service-providers/:id` | Admin | Deletes a provider account |

### Authentication validation rules

- Name: trimmed, 2–100 characters.
- Email: valid email, trimmed and normalized to lowercase.
- New passwords: 8–128 characters and must contain lowercase, uppercase, and numeric characters.
- Email verification token lifetime in the service: 30 minutes.
- Password reset token lifetime in the service: 10 minutes.

## 5. Tours

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/tours` | Optional Auth | Lists tours; query object is passed to service filtering/pagination |
| GET | `/tours/:id` | Optional Auth | Tour details; authenticated role/identity may affect visibility |
| POST | `/tours/createTour` | Admin or Travel Provider | Validated `CreateTourSchema`; provider-created records enter approval workflow |
| PATCH | `/tours/updateTour/:id` | Admin or Provider + ownership rules | Partial `CreateTourSchema` fields |
| DELETE | `/tours/deleteTour/:id` | Admin or Provider + ownership rules | Deletes permitted tour |
| PATCH | `/tours/admin/tours/:tourId/status` | Admin | `{ status: "approved" | "rejected" }` |
| POST | `/tours/:id/reviews` | Authenticated | `{ rating: 1..5 integer, comment?: string <=500 }`; add/update own review |
| GET | `/tours/:id/reviews` | Public | Returns tour reviews |
| DELETE | `/tours/:id/reviews/:reviewUserId` | Authenticated | Deletes review subject to service authorization |

### Create tour body

Required: `title`, `slug`, `summary`, `mainImage` (URL), `duration`, `locations[]`, `priceTiers[]`, `languages[]`, `providerInfo`.

Optional: `fullDescription`, `gallery[]`, `startDates[]`, `highlights[]`, `activities[]`, `inclusiveItems[]`, `exclusiveItems[]`, `cancellationPolicy`, `difficulty`, `tags[]`, `recommended`.

Nested structures:

- `locations[]`: `{ name, country, city? }`
- `priceTiers[]`: `{ type, price }` with positive price
- `startDates[]`: `{ date, capacity }` with positive integer capacity
- `providerInfo`: `{ name, contact? }`

## 6. Hotels and rooms

Canonical prefix below is `/hotels`. The same operations are also reachable under `/api/hotels`.

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/hotels` | Optional Auth | Lists hotels with pagination/filtering handled by service |
| GET | `/hotels/:hotelId` | Optional Auth | Hotel details |
| POST | `/hotels/admin/hotels` | Admin or Travel Provider | Creates hotel using validated hotel body |
| PATCH | `/hotels/admin/hotels/:hotelId` | Admin or Provider + ownership rules | Updates hotel; controller currently does not attach a Zod update schema |
| DELETE | `/hotels/admin/hotels/:hotelId` | Admin or Provider + ownership rules | Deletes permitted hotel |
| POST | `/hotels/admin/:hotelId/rooms` | Admin or Provider + ownership rules | Creates room with validated room body |
| POST | `/hotels/admin/:hotelId/images` | Admin or Provider + ownership rules | `multipart/form-data`, field `images`, maximum 5 files; at least one required |
| PATCH | `/hotels/admin/rooms/:roomId` | Admin or Provider + ownership rules | Partial validated room body |
| DELETE | `/hotels/admin/rooms/:roomId` | Admin or Provider + ownership rules | Deletes room |
| PATCH | `/hotels/admin/hotels/:hotelId/status` | Admin | `{ status: "approved" | "rejected" }` |

### Create hotel body

Required: `name`, `location` object.

Optional: `description`, `rating` (0–5), `amenities[]`, `policies`.

`location`: `{ city?, address?, lat?, lng? }`

`policies`: `{ checkIn?, checkOut?, cancellation? }`

### Create room body

Required: `name`, `occupancy.adults` (positive integer), `pricePerNight` (positive number).

Optional: `occupancy.children` (integer >=0), `refundable`, `amenities[]`.

## 7. Bookings

The entire booking router requires authentication.

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| POST | `/bookings` | Authenticated | Creates booking |
| GET | `/bookings/my-bookings` | Authenticated | Lists current user's bookings |
| GET | `/bookings/:bookingId` | Authenticated | Booking details, authorization enforced by service |
| PATCH | `/bookings/:bookingId/cancel` | Authenticated | Cancels permitted booking |
| PATCH | `/bookings/:bookingId/status` | Admin or Provider | `{ status: pending | confirmed | cancelled }`; confirmation is gated by successful-payment middleware |
| GET | `/bookings/admin/stats/by-category` | Admin | Booking counts grouped by category |
| GET | `/bookings/admin/stats/revenue` | Admin | Revenue grouped by category |
| GET | `/bookings/admin/stats/by-status` | Admin | Booking counts grouped by status |

### Create booking body

```json
{
  "category": "tours | flights | cars | hotels",
  "itemId": "string",
  "startDate": "valid date string",
  "endDate": "valid date string",
  "details": {}
}
```

`endDate` must be later than `startDate`. `details` is optional.

## 8. Cars

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/cars` | Public | Approved cars only; query filters: `city`, `type`, `available=true|false` |
| GET | `/cars/:id` | Public | Approved car details |
| POST | `/cars/createCar` | Admin or Travel Provider | Validated create body |
| PATCH | `/cars/updateCar/:id` | Authenticated Owner/Admin | Validated partial update; service prevents non-owner updates |
| DELETE | `/cars/deleteCar/:id` | Authenticated Owner/Admin | Service prevents non-owner deletion and blocks deletion with active booking |
| PATCH | `/cars/admin/:id/status` | Admin | `{ status: "approved" | "rejected" }` |

### Create car body

Required: `brand`, `model`, `type`, `transmission`, `fuelType`, `seats`, `pricePerDay`, `location.city`.

Optional: `year`, `available`, `location.address`, `image`.

Enums:

- `type`: `SUV`, `Sedan`, `Hatchback`, `Convertible`, `Luxury`
- `transmission`: `Automatic`, `Manual`
- `fuelType`: `Petrol`, `Diesel`, `Electric`, `Hybrid`

## 9. Flights

Canonical prefix below is `/flights`. The same operations are also reachable under `/api/flights`.

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/flights` | Public | Lists flights; filtering handled by service |
| GET | `/flights/:id` | Public | Flight details |
| POST | `/flights/createFlight` | Admin or Travel Provider | Validated create body |
| PATCH | `/flights/updateFlight/:id` | Admin or Provider + ownership rules | Validated partial body |
| DELETE | `/flights/deleteFlight/:id` | Admin or Provider + ownership rules | Deletes permitted flight |
| PATCH | `/flights/updateFlightStatus/:id` | Admin | Approval/status operation handled by service |

### Create flight body

Required: `airline`, `flightNumber`, `departureAirport`, `arrivalAirport`, `departureTime`, `arrivalTime`, `price`, `availableSeats`.

Optional: `class`.

Rules:

- Airport values are exactly 3 characters.
- Departure/arrival times must parse as valid date strings.
- `price` and `availableSeats` are non-negative.
- `class`: `Economy`, `Business`, or `First`.

## 10. Notifications

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Current user's notifications; `page` default 1, `limit` default 20 and capped at 100; returns unread count |
| PATCH | `/notifications/:id/read` | Authenticated Owner | Marks one owned notification read |
| PATCH | `/notifications/read-all` | Authenticated | Marks all current-user unread notifications read |

## 11. Favorites

Supported favorite categories are `tours`, `hotels`, `cars`, and `flights`.

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| POST | `/favorites` | Authenticated | `{ category, itemId }`; validates target item exists and rejects duplicate favorites |
| DELETE | `/favorites/:category/:itemId` | Authenticated | Removes current user's favorite |
| GET | `/favorites` | Authenticated | Lists favorites and populates each referenced item when it still exists |

## 12. Packages

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/packages` | Optional Auth | Lists packages; role/identity may affect visibility |
| GET | `/packages/:id` | Public | Package details |
| POST | `/packages` | Admin or Travel Provider | Creates package using validated body |
| PATCH | `/packages/:id/status` | Admin | `{ status: "approved" | "rejected" }` |
| POST | `/packages/:id/book` | Authenticated | Books package items using validated per-item dates/details |
| PATCH | `/packages/:id/featured` | Admin | `{ featured: boolean }` |

### Create package body

Required: `title`, `items` (minimum 2), `discountPercentage` (1–90).

Optional: `description`, `coverImage` URL, `gallery[]` URLs, `country`, `cities[]`, `tags[]`, `packageType`, `durationLabel`, `validUntil` ISO datetime.

`packageType`: `family`, `couples`, `luxury`, `budget`, `adventure`, `business`.

Each package definition item: `{ category, itemId, order? }`, where category is one of `hotels`, `tours`, `flights`, `cars`.

Each booking item: `{ category, itemId, startDate, endDate, details? }`.

## 13. User profile

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/users/my-profile` | Authenticated | Returns current authenticated user profile |
| POST | `/users/upload-profile-picture` | Authenticated | `multipart/form-data`; single file field named `image` |
| PATCH | `/users/update-profile-info` | Authenticated | Accepts `name` and/or `email`; changing email marks account unverified |

The profile-information endpoint currently performs its checks in the service rather than through a dedicated request-validation schema.

## 14. Admin management API

All routes below require the `admin` role.

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/admin/dashboard/stats` | Admin | Aggregate dashboard statistics |
| GET | `/admin/users` | Admin | User management listing; query object passed to admin service |
| PATCH | `/admin/users/:id/role` | Admin | `{ role, providerType? }`; role must be `user`, `provider`, or `admin`; provider role requires `travel`, `telecom`, or `both` |
| GET | `/admin/services` | Admin | Cross-service management listing; query object passed to admin service |
| PATCH | `/admin/services/:type/:id/status` | Admin | `{ status }`; service type/status validation occurs in admin service |
| GET | `/admin/bookings` | Admin | Admin booking listing; query object passed to admin service |
| PATCH | `/admin/bookings/:id/status` | Admin | `{ status }`; validation occurs in admin service |
| GET | `/admin/audit-logs` | Admin | Audit-log listing; query object passed to admin service |

Role-change safeguards include preventing an admin from removing their own admin role and preventing removal of the final admin account.

## 15. Provider dashboard API

The entire provider router requires role `provider`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/provider/dashboard/stats` | Provider | Statistics scoped to authenticated provider |
| GET | `/provider/operations` | Provider | Provider-owned bookings and eSIM operations |

## 16. eSIM API

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/esim/plans` | Optional Auth | Lists eSIM plans with service filtering/pagination |
| GET | `/esim/plans/:id` | Optional Auth | eSIM plan details |
| POST | `/esim/plans` | Admin or Telecom Provider | Creates plan with validated body |
| PATCH | `/esim/plans/:id` | Admin or Provider + ownership rules | Partial validated plan body |
| DELETE | `/esim/plans/:id` | Admin or Provider + ownership rules | Deletes permitted plan |
| PATCH | `/esim/plans/:id/status` | Admin | `{ status: "approved" | "rejected" }` |
| POST | `/esim/orders` | Authenticated | `{ planId, packageBookingId? }`; creates order only; payment is required before provisioning |
| GET | `/esim/orders/my-orders` | Authenticated | Lists current user's eSIM orders |
| GET | `/esim/orders/:id` | Authenticated | Gets permitted eSIM order |
| POST | `/esim/orders/:id/retry-provision` | Authenticated | Retries provisioning for a paid order |
| PATCH | `/esim/orders/:id/activate` | Authenticated | Activates permitted eSIM order |

### Create eSIM plan body

Required: `name`, `country`, `dataAmount`, `validityDays`, `price`.

Optional: `region`, `dataUnit`, `currency`.

- `dataUnit`: `MB`, `GB`, or `Unlimited`
- `dataAmount` and `price`: positive numbers
- `validityDays`: positive integer
- `currency`: exactly 3 characters when supplied

> The API and payment/provisioning workflow are implemented. The current codebase must not be documented as using a verified production telecom carrier unless a real carrier provider implementation and runtime evidence are separately supplied.

## 17. Payments / Stripe

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| GET | `/payments/status` | Admin | Stripe configuration/diagnostic status |
| POST | `/payments/checkout-session` | Authenticated | Creates hosted Stripe Checkout Session for exactly one payment target |
| GET | `/payments/checkout-session/:sessionId` | Authenticated | Verifies/reconciles current user's Checkout Session |
| POST | `/payments/create-intent` | Authenticated | Creates PaymentIntent for exactly one payment target |
| POST | `/payments/confirm` | Authenticated | `{ paymentIntentId }`; confirms/finalizes supported payment workflow |

For checkout-session and payment-intent creation, the strict body must contain **exactly one** of:

- `bookingId`
- `packageBookingId`
- `esimOrderId`

### Stripe webhook

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/webhooks/stripe` | Stripe signature verification | Processes supported Stripe webhook events using raw request body and `stripe-signature` header |

Handled event types currently include:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

The webhook returns `503` when Stripe or the webhook secret is not configured, `400` on missing/invalid Stripe signature, and `500` when a verified event cannot be processed.

## 18. Ask SAFARNI AI flight search

| Method | Path | Access | Request / behavior |
|---|---|---|---|
| POST | `/ai-search/flights` | Public | `{ prompt }`; natural-language flight search; prompt is trimmed and must be 5–500 characters |
| GET | `/ai-search/status` | Admin | AI/n8n configuration diagnostics |

The AI flight-search route has its own rate limiter: in production, maximum 8 requests per minute per IP (30/minute outside production).

The current implementation uses AI for intent extraction and the configured n8n flight-search webhook for live flight aggregation. It is not a general multi-service chatbot endpoint.

## 19. Request validation and content types

Most structured write operations use Zod through `validateRequest`, and many bodies are `strictObject`, so undocumented additional keys are rejected for those operations.

Content types used by the API:

- `application/json`: normal API requests
- `multipart/form-data`: profile image and hotel image uploads
- raw `application/json`: Stripe webhook before signature verification

The global JSON body limit is 1 MB. The Stripe raw webhook body limit is also 1 MB.

## 20. Rate limiting and HTTP security controls

Current backend middleware includes:

- Global Express rate limit: 200 requests per 15 minutes per IP.
- Authentication router production limit: 10 requests per 15 minutes per IP.
- AI search production limit: 8 requests per minute per IP.
- Helmet security headers.
- `x-powered-by` disabled.
- CORS origin restricted to configured `FRONTEND_URL` with credentials enabled.
- Request bodies are intentionally not logged.

## 21. Response and error conventions

Many endpoints use the shared `successResponse` helper and return a response containing success/message/data and, where applicable, pagination/info fields. A few legacy/listing endpoints construct their own compatible JSON directly.

Errors are routed through the global error handler after the not-found middleware. Exact error status depends on the thrown application exception (for example bad request, unauthorized, forbidden, or not found).

## 22. Implementation-grounded caveats

1. **Production URL not verified.** This reference uses relative paths and the local default only.
2. **Hotel and flight aliases are full-router aliases.** `/api/hotels` and `/api/flights` duplicate every route in those routers, including protected management routes.
3. **Some endpoints validate in service code rather than Zod.** Examples include profile update and several admin status mutations.
4. **Automated API test coverage is incomplete.** The repository has a Newman command for a tours Postman collection, but the default `npm test` script is still a placeholder; this reference therefore does not claim full automated API coverage.
5. **eSIM carrier production integration is not proven by this route inventory.** API/order/payment/provisioning logic and a provider abstraction exist, but production carrier evidence must be documented separately.
6. **AI live-search runtime proof is separate from route existence.** The endpoint exists and is wired to configured integrations, but a successful external OpenAI+n8n+FlightAPI execution should be retained as runtime evidence before calling the integration production-verified.

## 23. Source-of-truth files

Primary implementation files used for this reference include:

- `app.ts`
- `routes/index.ts`
- `middleware/auth.middleware.ts`
- `utils/cookies/cookies.ts`
- `modules/*/*.controller.ts`
- `modules/payment/payment.webhook.ts`
- `modules/*/types/zod.types.ts`
- `modules/authentication/authentication.service.ts`
- `modules/users/users.service.ts`
- `modules/car/car.service.ts`

When routes change, this document should be updated from the implementation before being copied into the graduation documentation or converted to OpenAPI/Postman.
