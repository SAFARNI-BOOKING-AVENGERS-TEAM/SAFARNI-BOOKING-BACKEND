# Travel System Marketplace API

An integrated travel marketplace backend for Tours, Flights, Cars, and Hotels. The backend API is constructed using Node.js, Express, and TypeScript, connected to a MongoDB database. It includes user authentication, module routing, global error handling, and data validation.

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
