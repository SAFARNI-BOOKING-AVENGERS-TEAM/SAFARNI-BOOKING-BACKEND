# SAFARNI Requirements Traceability & Verification Matrix

**Baseline:** `security/hardening-v1` backend + `security-dashboard/hardening-v1` frontend

**Purpose:** map project requirements to concrete implementation evidence and clearly separate implementation proof from runtime/testing proof. This matrix is intended for graduation documentation, acceptance review, and final discussion preparation.

## Status legend

| Status | Meaning |
|---|---|
| SOURCE VERIFIED | Requirement is directly supported by current repository code/configuration |
| CI PASS | Requirement is exercised by a successful GitHub Actions validation step |
| USER-RUNTIME VERIFIED | A user-run local workflow has demonstrated the behavior in this project session |
| PARTIALLY VERIFIED | Implementation exists, but only part of the end-to-end behavior has been proven |
| PENDING | Evidence collection or runtime validation is still outstanding |
| LIMITATION | Architecture exists but a production/external dependency is intentionally missing or mocked |
| NOT IMPLEMENTED | Required capability is not present in the verified implementation |

> A source-level implementation is not automatically treated as production runtime proof. External services, cloud deployment, security scans, and live integrations must be evidenced separately.

---

# 1. Functional requirements

| ID | Requirement | Implementation evidence | Verification | Current status |
|---|---|---|---|---|
| FR-01 | User registration | `modules/authentication/*`, signup schema/service, email verification workflow | Source review; backend build/CI | SOURCE VERIFIED + CI PASS |
| FR-02 | Email verification | Hashed verification token, expiry, `/auth/verify-email/:token` | Source review | SOURCE VERIFIED |
| FR-03 | Secure login/logout/session refresh | Cookie-based access/refresh tokens, refresh-token versioning, logout revocation | `middleware/auth.middleware.ts`, token/cookie utilities, auth service | SOURCE VERIFIED |
| FR-04 | Password reset | Request + confirm endpoints, hashed reset token, expiry, generic account-discovery-safe response | Auth schemas/services | SOURCE VERIFIED |
| FR-05 | Role-based access | Roles: `user`, `provider`, `admin`; provider types: `travel`, `telecom`, `both` | auth/admin/provider middleware and user model | SOURCE VERIFIED |
| FR-06 | Travel service discovery | Tours, hotels/rooms, flights, cars and packages expose browsing/detail routes | Controllers/services documented in `docs/API_REFERENCE.md` | SOURCE VERIFIED |
| FR-07 | Provider service creation/management | Provider/admin create/update/delete travel services with ownership rules | Tour/hotel/flight/car/package controllers/services | SOURCE VERIFIED |
| FR-08 | Admin approval/rejection workflow | Service status values `pending`, `approved`, `rejected`; admin status endpoints | Travel/eSIM models and controllers | SOURCE VERIFIED |
| FR-09 | Booking creation | Booking categories: tours, flights, cars, hotels; date/details validation | `modules/booking/*`, `DB/models/booking.model.ts` | SOURCE VERIFIED |
| FR-10 | Booking availability enforcement | Room/car overlap checks, flight seat checks/decrement, tour capacity checks | `booking.service.ts` | SOURCE VERIFIED |
| FR-11 | Booking concurrency protection | Per-resource lock around availability/read-modify-write booking sections | booking service + concurrency lock utility | SOURCE VERIFIED |
| FR-12 | Booking status/cancellation | Pending/confirmed/cancelled lifecycle; provider ownership checks; cancellation logic | booking controller/service | SOURCE VERIFIED |
| FR-13 | Package creation and package booking | Multi-item packages, discounting, package booking group ID and rollback behavior | `modules/package/*`, booking internal package workflow | SOURCE VERIFIED |
| FR-14 | Favorites | Add/remove/list favorites for tours, hotels, cars and flights; duplicate prevention | favorite controller/model | SOURCE VERIFIED |
| FR-15 | Notifications | Persistent notifications + mark read/read-all | notification controller/model | SOURCE VERIFIED |
| FR-16 | Real-time user notifications | Authenticated Socket.IO connection using access cookie and private user room | `socket/socket.ts`, notification helper | SOURCE VERIFIED; live socket session not separately evidenced |
| FR-17 | User profile management | Profile retrieval, profile information update, image upload | `modules/users/*`, upload middleware | SOURCE VERIFIED |
| FR-18 | Admin dashboard/operations | Dashboard statistics, users, services, bookings, audit logs | `modules/admin/*` | SOURCE VERIFIED |
| FR-19 | Provider dashboard/operations | Provider dashboard stats and booking/eSIM operational view | `modules/provider/*` | SOURCE VERIFIED |
| FR-20 | Stripe hosted checkout | Checkout-session creation, session verification, webhook fulfillment | `modules/payment/*`, Stripe client | SOURCE VERIFIED + USER-RUNTIME VERIFIED for hosted checkout flow |
| FR-21 | Stripe payment intent path | Create payment intent and confirm payment endpoints | payment controller/service | SOURCE VERIFIED |
| FR-22 | Payment-gated booking confirmation | Booking confirmation middleware requires successful payment | `paidBookingConfirmation.middleware.ts` + booking route | SOURCE VERIFIED |
| FR-23 | Stripe webhook security | Raw webhook body and Stripe signature verification | `modules/payment/payment.webhook.ts`, app webhook mount | SOURCE VERIFIED |
| FR-24 | Booking refund handling | Cancellation can invoke payment refund logic and records refund metadata | booking/payment services, Payment model refunds | SOURCE VERIFIED; live refund not claimed |
| FR-25 | eSIM catalog | eSIM plan CRUD, provider type restrictions, approval workflow | `modules/esim/*`, `ESIMPlan` model | SOURCE VERIFIED |
| FR-26 | eSIM purchase lifecycle | Order creation, payment-before-provisioning, retry provision, activation | eSIM/payment controllers/services | SOURCE VERIFIED |
| FR-27 | Real carrier eSIM provisioning | Provider abstraction exists | `modules/esim/providers/*` | LIMITATION — current verified provider is mock, not a live carrier integration |
| FR-28 | AI natural-language flight search | Public prompt endpoint with request validation and rate limiting | `modules/aiSearch/*` | SOURCE VERIFIED |
| FR-29 | Structured OpenAI trip parsing | Backend uses OpenAI Responses API path to produce validated search parameters | AI search service | SOURCE VERIFIED; live OpenAI call not yet captured as formal evidence |
| FR-30 | Live flight data workflow | AI search invokes configured n8n flight-search webhook and consumes returned flight offers | AI service + `integrations/n8n/Safarni_FlightAPI_v2.json` | PARTIALLY VERIFIED; implementation exists, live end-to-end evidence pending |
| FR-31 | AI flight result safety | Backend uses external returned fares and does not generate fare values itself | AI/n8n architecture | SOURCE VERIFIED |
| FR-32 | Search diagnostics for admin | AI and Stripe diagnostic endpoints restricted to admin | AI/payment controllers | SOURCE VERIFIED |
| FR-33 | File/image upload fallback | Upload abstraction supports local upload path when external image service is not configured | upload middleware + users/hotel routes | SOURCE VERIFIED |
| FR-34 | API audit logging | AuditLog model and admin audit-log retrieval | audit log model/middleware/admin service | SOURCE VERIFIED |

---

# 2. Data requirements and persistence traceability

| ID | Requirement | Data evidence | Status |
|---|---|---|---|
| DATA-01 | Persistent users and RBAC | `User` model | SOURCE VERIFIED |
| DATA-02 | Persistent travel inventory | `Tour`, `Hotel`, `Room`, `Flight`, `Car`, `Package` models | SOURCE VERIFIED |
| DATA-03 | Persistent booking history | `Booking` model | SOURCE VERIFIED |
| DATA-04 | Persistent payments | `Payment` model | SOURCE VERIFIED |
| DATA-05 | Persistent eSIM plans/orders | `ESIMPlan`, `ESIMOrder` models | SOURCE VERIFIED |
| DATA-06 | Persistent favorites | `Favorite` model with unique compound index | SOURCE VERIFIED |
| DATA-07 | Persistent notifications | `Notification` model | SOURCE VERIFIED |
| DATA-08 | Persistent administrative audit | `AuditLog` model | SOURCE VERIFIED |
| DATA-09 | Referential user ownership | Mongoose ObjectId references from services/payments/orders/notifications to `User` | SOURCE VERIFIED |
| DATA-10 | Polymorphic booking targets | `Booking.category + itemId` resolves hotel room/tour/flight/car at service layer | SOURCE VERIFIED |
| DATA-11 | Package booking grouping | Generated `packageBookingId` shared by component `Booking` documents; no separate PackageBooking collection | SOURCE VERIFIED |
| DATA-12 | Database schema documentation | `docs/DATABASE_REFERENCE.md` with model dictionary/ERD | SOURCE VERIFIED |

---

# 3. Security and non-functional requirements

| ID | Requirement | Evidence | Verification | Status |
|---|---|---|---|---|
| NFR-01 | Password strength validation | Zod auth schema: min/max + upper/lower/numeric rules | Source review | SOURCE VERIFIED |
| NFR-02 | Password hashing | hash/compare security utilities used by authentication service | Source review | SOURCE VERIFIED |
| NFR-03 | HTTP-only authentication cookies | `access_token`, `refresh_token` are `httpOnly`; Secure in production; SameSite=Lax | cookie utility | SOURCE VERIFIED |
| NFR-04 | Session revocation | `refreshTokenVersion` increment/validation | auth service/User model | SOURCE VERIFIED |
| NFR-05 | RBAC and provider-type authorization | admin/provider middleware and ownership checks | Source review | SOURCE VERIFIED |
| NFR-06 | Request validation | Zod schemas + validation middleware across core routes | Source review | SOURCE VERIFIED |
| NFR-07 | Rate limiting | auth and AI search limiters | routes/AI controller | SOURCE VERIFIED |
| NFR-08 | Payment webhook authenticity | Stripe signature verification using webhook secret | webhook code | SOURCE VERIFIED |
| NFR-09 | Sensitive config outside source manifests | Kubernetes Secret expected separately; example contains placeholders only | `deploy/k8s/*` | SOURCE VERIFIED |
| NFR-10 | Dependency vulnerability audit | `npm audit --omit=dev --audit-level=high` in both CI workflows | Successful GitHub Actions jobs | CI PASS |
| NFR-11 | Backend TypeScript compilation | `npm run build` | Local evidence + GitHub Actions | CI PASS; local PASS previously collected |
| NFR-12 | Frontend TypeScript validation | `npm run type-check` | GitHub Actions | CI PASS |
| NFR-13 | Frontend production build | `next build` | Local evidence + GitHub Actions | CI PASS; local PASS previously collected |
| NFR-14 | Secret scanning | Gitleaks Docker evidence runner | Security evidence collector | PENDING — corrected scan currently running |
| NFR-15 | Static application security testing | Semgrep Docker evidence runner | Security evidence collector | PENDING — corrected scan currently running |
| NFR-16 | Vulnerability/secret/misconfiguration scan | Trivy filesystem scan | Security evidence collector | PENDING — corrected scan currently running |
| NFR-17 | Automated unit/integration tests | Backend `npm test` is a placeholder; no verified comprehensive automated suite | Source review | NOT IMPLEMENTED / GAP |
| NFR-18 | Production performance/load test | No verified load-test evidence | Evidence inventory | PENDING / GAP |
| NFR-19 | Production observability/monitoring | No verified production APM/metrics/log platform | Evidence inventory | PENDING / GAP |

---

# 4. DevOps and deployment requirements

| ID | Requirement | Evidence | Verification | Status |
|---|---|---|---|---|
| DEV-01 | Backend containerization | Backend multi-stage `Dockerfile`, non-root runtime, healthcheck | CI Docker build | CI PASS |
| DEV-02 | Frontend containerization | Frontend multi-stage `Dockerfile`, non-root runtime, healthcheck | CI Docker build | CI PASS |
| DEV-03 | Minimal Docker build context | Backend/frontend `.dockerignore` | Source review | SOURCE VERIFIED |
| DEV-04 | Backend CI pipeline | `.github/workflows/ci.yml`: npm ci, audit, TS build, Docker build | GitHub Actions job completed successfully | CI PASS |
| DEV-05 | Frontend CI pipeline | `.github/workflows/ci.yml`: npm ci, audit, type-check, Next build, Docker build | GitHub Actions job completed successfully | CI PASS |
| DEV-06 | Kubernetes namespace/configuration | `deploy/k8s/namespace.yaml`, backend ConfigMap | Source review | SOURCE VERIFIED |
| DEV-07 | Kubernetes backend workload | Deployment + Service + probes + security context | `deploy/k8s/backend-*` | SOURCE VERIFIED |
| DEV-08 | Kubernetes frontend workload | Deployment + Service + probes + security context | `deploy/k8s/frontend-*` | SOURCE VERIFIED |
| DEV-09 | Kubernetes secret handling | Secret created out-of-repository from example/template | K8s README/template | SOURCE VERIFIED |
| DEV-10 | Kustomize deployment composition | `deploy/k8s/kustomization.yaml` | Source review; local render was reported completed | PARTIALLY VERIFIED; retain render log for final evidence pack |
| DEV-11 | Kubernetes live cluster deployment | Running pods/services in a Kubernetes cluster | No captured cluster runtime evidence yet | PENDING |
| DEV-12 | Infrastructure as Code with Terraform | No Terraform configuration or verified cloud target exists | Infrastructure discovery | NOT IMPLEMENTED / NOT CLAIMED |
| DEV-13 | Production cloud deployment | No verified public production URL/provider/runtime evidence | Evidence inventory | PENDING / NOT CLAIMED |
| DEV-14 | Container registry publication | No verified registry image tag/digest evidence | Evidence inventory | PENDING |
| DEV-15 | Continuous deployment | Current workflows validate/build only; no automatic production deployment | CI workflow review | NOT IMPLEMENTED / intentionally not claimed |

---

# 5. Documentation traceability

| Documentation artifact | Source of truth | Status |
|---|---|---|
| Backend API reference | Actual routes/controllers/Zod schemas | `docs/API_REFERENCE.md` — SOURCE VERIFIED |
| API request collection | Verified controller inventory | `docs/postman/SAFARNI_Backend_API.postman_collection.json` — inventory created; full runtime execution not claimed |
| Database reference / ERD | Actual Mongoose schemas and service relations | `docs/DATABASE_REFERENCE.md` — SOURCE VERIFIED |
| System architecture | Actual frontend/backend/database/integration/deployment implementation | `docs/ARCHITECTURE.md` — SOURCE VERIFIED |
| Requirements Traceability Matrix | This file | SOURCE VERIFIED with explicit evidence-state labels |
| Docker validation | Dockerfiles + local/CI evidence | CI PASS; preserve local collector summary separately |
| Kubernetes validation | Kubernetes manifests/Kustomize | Source verified; cluster runtime evidence pending |
| Security verification | Gitleaks + Semgrep + Trivy runner | PENDING current corrected scan |

---

# 6. Acceptance evidence still required

The following items must remain explicitly marked as pending/limited unless new evidence is captured:

1. Corrected Gitleaks, Semgrep and Trivy results.
2. Live Kubernetes cluster state (`kubectl get nodes/pods/services`) if Kubernetes runtime deployment is required by the grading rubric.
3. A verified production/cloud deployment URL, only if the team actually deploys the system.
4. Container registry tags/digests, only if images are pushed to a registry.
5. Live AI → OpenAI → n8n → flight-provider end-to-end evidence.
6. Real eSIM carrier integration; current provider implementation is mock.
7. Automated unit/integration test suite and coverage evidence.
8. Load/performance testing if required by the documentation template.
9. Production monitoring/observability evidence if required.
10. Terraform only if a genuine cloud target is selected; Terraform must not be added solely to manufacture evidence.

---

# 7. Final evidence rule

For the final SAFARNI documentation, claims should use this hierarchy:

**Runtime/CI evidence > source-code evidence > architecture intention.**

A feature may be described as implemented when source code proves it. It should only be described as tested, deployed, production-ready, or externally integrated when corresponding runtime evidence exists.
