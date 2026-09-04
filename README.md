# SAFARNI
An Integrated Travel Marketplace

Travel planning is frequently fragmented across independent platforms for flights, hotels, tours, car rentals, travel packages, and other trip services. This fragmentation makes service discovery and comparison more difficult, forces travelers to repeat information, and leaves reservations distributed across disconnected systems. At the same time, travel providers need a structured environment for publishing and managing their services, while administrators need centralized visibility over users, listings, roles, approvals, reservations, and operational activity.
SAFARNI was developed as an integrated travel marketplace that addresses these problems through one coherent digital platform. Its customer-facing scope includes tours and destination activities, hotels and room availability, searchable flight offers, car-rental listings, curated travel packages and discounts, and unified booking management. Travelers can explore available services, view service details, compare suitable options, create reservations, follow booking status and history, save favorite items, submit or view reviews, and receive relevant notifications. The platform therefore supports the main journey from discovery and comparison to booking and post-booking management without requiring a separate system for every travel service.
The platform supports four principal roles: guest, registered user, service provider, and administrator. Guests can browse public services and authentication pages; registered users can manage their accounts, favorites, bookings, reviews, and notifications; providers can publish, update, and track travel resources, availability, and reservations; and administrators can manage users, services, roles, approvals, and audit-oriented operations. The backend also contains prepared payment and eSIM service routes intended to extend SAFARNI with checkout and digital-connectivity services. These payments and eSIM modules are included in the project architecture and require final provider/API mounting and webhook integration before being considered live production services.
SAFARNI follows a modular full-stack architecture in which a Next.js and React frontend communicates with a RESTful Node.js and Express backend and a MongoDB database. TypeScript is used across the two applications. Tailwind CSS supports the responsive interface, Redux Toolkit manages authentication state, React Query and the API layer handle server data, and Mongoose defines the database models. The data layer represents users, travel services, bookings, payments, notifications, audit logs, and resource locks. The interface includes public, authentication, customer, provider, and administrative flows together with explicit loading, error, and empty states.
Security is enforced through registration and login flows, password hashing, verification and password-reset routes, JSON Web Tokens, HTTP-only cookies, protected pages, and backend-enforced role authorization. Delivery is organized as a repeating DevSecOps lifecycle: audit and plan the required change; align frontend and backend contracts; build and integrate through GitHub Actions; test and scan source code, secrets, dependencies, and container images using Gitleaks, Semgrep, dependency scanning, and Trivy; package the applications with Docker; represent infrastructure and deployment through Terraform and Kubernetes; then review the results and return the findings to the next planning iteration. This lifecycle keeps security and deployment readiness active throughout development rather than adding them only at the end.
Overall, SAFARNI combines traveler services, provider operations, administrative governance, authentication, data management, prepared payment and eSIM capabilities, and DevSecOps delivery within one maintainable graduation project. The resulting platform provides a strong base for academic demonstration and for future production integration with live travel suppliers, payment services, eSIM providers, production email delivery, wider localization, automated quality gates, and scalable operational services.

## 🚀 Features

- **Search & Booking**: Fully functional API routes for Tours and Hotels.
- **OTP Authentication**: Implements JSON Web Token (JWT) along with bcrypt and cookie-parser.
- **Secure Handling**: Built-in security and validation using Zod and Helmet.
- **Database Architecture**: Mongoose to manage multi-document collections and models.
- **Robust Error Handling**: Centralized error and 'Not Found' middlewares.
- **Scalable Architecture**: Code segmented into clear feature modules (`users`, `authentication`, `tour`, `hotel`).

## 🛠️ Technology Stack

- **Framework**: [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/)
- **Security**: `cors`, `helmet`, `bcrypt`, `jsonwebtoken`
- **Validation**: `zod`
- **Utility**: `dotenv`, `cookie-parser`, `nodemailer`

## 📁 Project Structure

```text
Travel-System-main/
├── DB/
│   ├── connect.ts          # Database connection module
│   └── models/             # Mongoose schemas
├── middleware/
│   └── notFound.middleware.ts
├── modules/
│   ├── authentication/     # Auth controllers & services
│   ├── hotel/              # Hotel management endpoints
│   ├── tour/               # Tour management endpoints
│   └── users/              # User management endpoints
├── types/                  # TypeScript interface definitions
├── utils/
│   └── response/           # Global error response handler
├── app.controller.ts       # Main controller router definition
├── index.ts                # App entry point
├── package.json
└── tsconfig.json
```

## ⚙️ Up and Running

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or Cloud instance)

### 2. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of your project and configure properties:

```env
PORT=3000
NODE_ENV=development
# Additional config logic for MongoDB URI and JWT Keys
```

### 4. Start the Application

**Development Mode** (with hot-reload):
```bash
npm run dev
```

**Production Mode**:
```bash
npm run build
npm start
```

## 📖 API Documentation

The root endpoint (`/`) responds with a detailed overview of the application status, category information, features, and an entry map to backend routing resources. (e.g., `/auth`, `/tours`, `/hotels`, etc.).

**Postman Collection** is included in `tours_api_tests.postman_collection.json` to facilitate API endpoint testing. run:
```bash
npm run test:api
```

## 👨‍💻 Actors

- `guest`
- `user`
- `admin`
- `support`
