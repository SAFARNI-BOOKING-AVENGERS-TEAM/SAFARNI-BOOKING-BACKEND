# SAFARNI UML, Use-Case, Activity, and Sequence Diagrams

**Verification basis:** current SAFARNI hardening branches and the implementation documented in `API_REFERENCE.md`, `DATABASE_REFERENCE.md`, `ARCHITECTURE.md`, and `REQUIREMENTS_TRACEABILITY_MATRIX.md`.

These diagrams describe implemented source-level behavior. External service calls are shown only where the code contains the integration. A diagram does not by itself claim production deployment or live external-service verification.

---

# 1. Actors and system use cases

```mermaid
flowchart LR
    U[Traveler / User]
    TP[Travel Provider]
    EP[Telecom Provider]
    A[Administrator]
    S[Stripe]
    O[OpenAI]
    N[n8n Flight Workflow]
    F[Flight Data Provider]
    E[eSIM Provider Abstraction]

    subgraph SAFARNI[SAFARNI Platform]
      UC1[Register / Verify Email / Login]
      UC2[Browse Tours Hotels Flights Cars]
      UC3[Manage Favorites]
      UC4[Create and Manage Bookings]
      UC5[Book Travel Packages]
      UC6[Pay for Booking / Package / eSIM]
      UC7[View Notifications]
      UC8[Manage User Profile]
      UC9[AI Flight Search]
      UC10[Purchase and Activate eSIM]
      UC11[Create Travel Services]
      UC12[Manage Provider Operations]
      UC13[Create eSIM Plans]
      UC14[Approve / Reject Services]
      UC15[Manage Users and Roles]
      UC16[View Admin Dashboard / Audit Logs]
    end

    U --> UC1
    U --> UC2
    U --> UC3
    U --> UC4
    U --> UC5
    U --> UC6
    U --> UC7
    U --> UC8
    U --> UC9
    U --> UC10

    TP --> UC1
    TP --> UC11
    TP --> UC12
    TP --> UC7

    EP --> UC1
    EP --> UC13
    EP --> UC12
    EP --> UC7

    A --> UC14
    A --> UC15
    A --> UC16
    A --> UC11
    A --> UC13

    UC6 --> S
    UC9 --> O
    UC9 --> N
    N --> F
    UC10 --> E
```

## Actor responsibilities

| Actor | Verified responsibilities |
|---|---|
| Traveler/User | Search/browse, favorites, booking, package booking, payment, eSIM purchase, profile, notifications, AI flight search |
| Travel Provider | Create/manage permitted travel services, manage owned bookings, view provider dashboard/operations |
| Telecom Provider | Create/manage eSIM plans and provider operations |
| Administrator | User/role administration, service approval, booking administration, dashboards, audit logs, diagnostics |
| Stripe | Hosted Checkout/payment processing and webhook events |
| OpenAI | Structured extraction of flight-search intent from natural-language request |
| n8n | Flight-search workflow orchestration |
| Flight Data Provider | Returns external flight offers through the n8n workflow |
| eSIM Provider Abstraction | Provisioning interface; current verified concrete provider is mock |

---

# 2. Authentication activity diagram

```mermaid
flowchart TD
    A[User submits registration] --> B{Input valid?}
    B -- No --> X[Validation error]
    B -- Yes --> C{Email already exists?}
    C -- Yes --> Y[Registration rejected]
    C -- No --> D[Hash password]
    D --> E[Create unverified user]
    E --> F[Create hashed verification token + expiry]
    F --> G[Send verification link]
    G --> H[User opens verification link]
    H --> I{Token valid and unexpired?}
    I -- No --> J[Verification rejected]
    I -- Yes --> K[Mark user verified]
    K --> L[User submits login]
    L --> M{Credentials valid and verified?}
    M -- No --> N[Login rejected]
    M -- Yes --> O[Generate access + refresh JWTs]
    O --> P[Set HTTP-only cookies]
    P --> Q[Authenticated session]
```

---

# 3. Login/session sequence

```mermaid
sequenceDiagram
    actor User
    participant FE as Next.js Frontend
    participant API as Express API
    participant DB as MongoDB

    User->>FE: Enter email + password
    FE->>API: POST /auth/login
    API->>DB: Find user by normalized email
    DB-->>API: User record + password hash
    API->>API: Compare password hash
    API->>API: Verify account is email-verified
    API->>API: Generate access + refresh JWTs
    API-->>FE: Set HTTP-only cookies + user data
    FE-->>User: Authenticated application state

    Note over FE,API: Protected calls use cookies, not Authorization Bearer headers.

    FE->>API: Protected request with access_token cookie
    API->>API: authMiddleware verifies JWT
    API->>DB: Resolve current user
    API-->>FE: Protected response
```

---

# 4. Single booking activity diagram

```mermaid
flowchart TD
    A[Authenticated user submits booking] --> B[Validate category, item, start/end dates]
    B --> C{Dates valid?}
    C -- No --> X[Reject request]
    C -- Yes --> D{Category}

    D -->|Hotel| H[Resolve Room + Hotel]
    D -->|Tour| T[Resolve Tour + selected start date]
    D -->|Flight| F[Resolve Flight]
    D -->|Car| R[Resolve Car]

    H --> H1{Room overlaps existing booking?}
    H1 -- Yes --> X
    H1 -- No --> P[Calculate total price]

    T --> T1{Tour capacity available?}
    T1 -- No --> X
    T1 -- Yes --> P

    F --> F1{Enough seats?}
    F1 -- No --> X
    F1 -- Yes --> F2[Decrement seats]
    F2 --> P

    R --> R1{Car available + no overlap?}
    R1 -- No --> X
    R1 -- Yes --> P

    P --> Q[Create pending Booking]
    Q --> N[Notify service owner]
    N --> Z[Return booking]
```

---

# 5. Booking + hosted Stripe checkout sequence

```mermaid
sequenceDiagram
    actor User
    participant FE as Next.js Frontend
    participant API as SAFARNI API
    participant DB as MongoDB
    participant Stripe

    User->>FE: Select service and dates
    FE->>API: POST /bookings
    API->>DB: Check inventory/availability
    API->>DB: Create pending Booking
    API-->>FE: Booking ID + calculated price

    User->>FE: Continue to payment
    FE->>API: POST /payments/checkout-session {bookingId}
    API->>DB: Validate booking ownership/state
    API->>Stripe: Create Checkout Session
    Stripe-->>API: Checkout Session
    API->>DB: Create/update pending Payment
    API-->>FE: Hosted Checkout URL/session data

    FE->>Stripe: Browser redirect to hosted Checkout
    User->>Stripe: Complete payment
    Stripe-->>API: POST /webhooks/stripe + signature
    API->>API: Verify Stripe webhook signature
    API->>DB: Finalize payment as succeeded
    API->>DB: Fulfill related booking/payment state

    Stripe-->>FE: Browser returns to checkout success URL
    FE->>API: GET /payments/checkout-session/:sessionId
    API->>Stripe: Verify session if necessary
    API->>DB: Reconcile/finalize persisted payment state
    API-->>FE: Verified payment result
    FE-->>User: Payment success / booking state
```

---

# 6. Booking cancellation/refund sequence

```mermaid
sequenceDiagram
    actor User
    participant API as SAFARNI API
    participant DB as MongoDB
    participant Stripe

    User->>API: PATCH /bookings/:bookingId/cancel
    API->>DB: Load booking
    API->>API: Verify booking ownership
    alt Flight booking
      API->>DB: Restore booked flight quantity
    end
    API->>DB: Mark booking cancelled
    API->>DB: Find associated successful payment
    opt Refundable paid booking
      API->>Stripe: Create refund
      Stripe-->>API: Refund result
      API->>DB: Append refund metadata to Payment
    end
    API-->>User: Cancellation result
```

---

# 7. Package booking sequence

```mermaid
sequenceDiagram
    actor User
    participant API as SAFARNI API
    participant PKG as Package Service
    participant BOOK as Booking Service
    participant DB as MongoDB

    User->>API: POST /packages/:id/book
    API->>PKG: Validate package + requested component items
    PKG->>DB: Load approved package
    PKG->>BOOK: createPackageBookingInternal(...)
    BOOK->>BOOK: Generate shared packageBookingId

    loop Each requested package item
      BOOK->>DB: Check item availability/ownership data
      BOOK->>DB: Create discounted pending Booking
    end

    alt Any component fails
      BOOK->>DB: Roll back already-created component bookings
      BOOK-->>PKG: Throw booking error
      PKG-->>User: Package booking rejected
    else All components succeed
      BOOK->>DB: Load created bookings
      BOOK-->>PKG: packageBookingId + bookings[]
      PKG-->>User: Package booking created
    end
```

> `packageBookingId` is a grouping string stored on the individual Booking documents. The verified implementation does not define a separate PackageBooking collection.

---

# 8. Service-provider approval sequence

```mermaid
sequenceDiagram
    actor Provider
    actor Admin
    participant API as SAFARNI API
    participant DB as MongoDB
    participant Socket as Socket.IO / Notification Layer

    Provider->>API: Create travel/eSIM service
    API->>API: Authenticate + verify provider type
    API->>DB: Create service with pending status
    API-->>Provider: Service submitted

    Admin->>API: PATCH service status approved/rejected
    API->>API: Authenticate admin role
    API->>DB: Update service status
    API->>DB: Create provider notification
    API->>Socket: Emit notification when socket layer is available
    Socket-->>Provider: Private user-room notification
```

---

# 9. Notification sequence

```mermaid
sequenceDiagram
    participant Service as Booking/Approval Service
    participant DB as MongoDB
    participant Socket as Socket.IO
    participant FE as Frontend

    Service->>DB: Create Notification(userId, title, message, type)
    opt User has authenticated socket connection
      Service->>Socket: Emit to room userId
      Socket-->>FE: Real-time notification event
    end
    FE->>DB: via GET /notifications
    DB-->>FE: Persistent notification history + unread count
    FE->>DB: via PATCH /notifications/:id/read or /read-all
```

---

# 10. AI flight-search activity diagram

```mermaid
flowchart TD
    A[User enters natural-language flight request] --> B[POST /ai-search/flights]
    B --> C[Rate-limit + Zod prompt validation]
    C --> D[OpenAI structured extraction]
    D --> E{Required trip fields available?}
    E -- No --> F[Return needs_input]
    E -- Yes --> G[Normalize airports/date/passengers/class]
    G --> H[Call configured n8n flight webhook]
    H --> I[n8n calls external flight-data provider]
    I --> J[n8n filters/sorts returned offers]
    J --> K[Backend validates/normalizes external results]
    K --> L[Return flight offers to frontend]
```

---

# 11. AI flight-search sequence

```mermaid
sequenceDiagram
    actor User
    participant FE as Next.js Frontend
    participant API as AI Search Service
    participant OAI as OpenAI
    participant N8N as n8n
    participant FDP as Flight Data Provider

    User->>FE: "Find me the 5 cheapest flights to Paris..."
    FE->>API: POST /ai-search/flights {prompt}
    API->>API: Validate/rate-limit prompt
    API->>OAI: Structured Responses request
    OAI-->>API: Parsed trip/search parameters

    alt Missing required search input
      API-->>FE: status=needs_input + missing fields
      FE-->>User: Ask for missing travel details
    else Search parameters complete
      API->>N8N: Flight search request
      N8N->>FDP: External flight search
      FDP-->>N8N: Real flight offer data
      N8N-->>API: Filtered/sorted offers
      API->>API: Normalize/cache returned offers
      API-->>FE: Flight search results
      FE-->>User: Display external provider offers
    end
```

> The AI component interprets the request; prices and flight offers come from the external flight-data workflow rather than being generated by the language model.

---

# 12. eSIM purchase/provisioning activity diagram

```mermaid
flowchart TD
    A[User browses approved eSIM plans] --> B[POST /esim/orders]
    B --> C[Create pending eSIM order]
    C --> D[Payment required]
    D --> E[Create Stripe checkout session for esimOrderId]
    E --> F{Payment succeeded?}
    F -- No --> G[Order remains unpaid/pending]
    F -- Yes --> H[Provision eSIM through provider abstraction]
    H --> I{Provision successful?}
    I -- No --> J[Order failed / retry provision available]
    I -- Yes --> K[Store eSIM profile data]
    K --> L[Order completed]
    L --> M[User activates eSIM]
    M --> N[Profile status activated]
```

---

# 13. eSIM provisioning sequence

```mermaid
sequenceDiagram
    actor User
    participant API as SAFARNI API
    participant DB as MongoDB
    participant Stripe
    participant Provider as eSIM Provider Abstraction

    User->>API: POST /esim/orders {planId}
    API->>DB: Create pending ESIMOrder
    API-->>User: Order requires payment

    User->>API: POST /payments/checkout-session {esimOrderId}
    API->>Stripe: Create hosted checkout
    Stripe-->>API: Checkout session
    API-->>User: Checkout URL

    Stripe-->>API: Paid webhook/session verification
    API->>DB: Mark payment succeeded
    API->>Provider: Provision paid eSIM order

    alt Provision succeeds
      Provider-->>API: eSIM profile data
      API->>DB: Save profile + completed status
    else Provision fails
      API->>DB: Mark order failed
      User->>API: POST /esim/orders/:id/retry-provision
      API->>Provider: Retry provisioning
    end
```

> Current verified concrete provider is a mock provider. This sequence represents the implemented provider abstraction and order/payment lifecycle, not a claim of live carrier integration.

---

# 14. Admin governance sequence

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Admin Frontend
    participant API as Admin API
    participant DB as MongoDB

    Admin->>FE: Open admin dashboard
    FE->>API: GET /admin/dashboard/stats
    API->>API: authMiddleware + admin authorization
    API->>DB: Aggregate user/service/booking statistics
    DB-->>API: Dashboard data
    API-->>FE: Admin statistics

    Admin->>FE: Update user/service/booking
    FE->>API: Admin PATCH request
    API->>API: Validate admin authorization/business rule
    API->>DB: Apply change
    API-->>FE: Updated record/status

    FE->>API: GET /admin/audit-logs
    API->>DB: Query persisted audit history
    DB-->>FE: Audit records
```

---

# 15. Deployment component diagram

```mermaid
flowchart TB
    Browser[Browser]
    Front[Next.js Frontend Container :3000]
    Back[Express + Socket.IO Backend Container :5000]
    Mongo[(MongoDB)]
    Stripe[Stripe]
    OAI[OpenAI]
    N8N[n8n Flight Workflow]
    FlightAPI[External Flight Data]
    ESIM[eSIM Provider Abstraction]

    Browser --> Front
    Front --> Back
    Browser -. authenticated websocket .-> Back
    Back --> Mongo
    Back --> Stripe
    Stripe -->|Webhook| Back
    Back --> OAI
    Back --> N8N
    N8N --> FlightAPI
    Back --> ESIM
```

The repository additionally contains Dockerfiles, Kubernetes manifests and GitHub Actions build/audit/container validation. No public cloud provider or production URL is asserted by this diagram.

---

# 16. Diagram-to-requirement traceability

| Diagram | Primary requirements |
|---|---|
| Actors/use cases | FR-01 through FR-34 overview |
| Authentication activity/sequence | FR-01–FR-05, NFR-01–NFR-05 |
| Booking activity | FR-09–FR-12 |
| Booking + Stripe | FR-20–FR-24 |
| Package booking | FR-13 |
| Provider approval | FR-07, FR-08, FR-15, FR-16 |
| Notification flow | FR-15, FR-16 |
| AI flight search | FR-28–FR-32 |
| eSIM purchase/provisioning | FR-25–FR-27 |
| Admin governance | FR-18, FR-32, FR-34 |
| Deployment component | DEV-01–DEV-15 |
