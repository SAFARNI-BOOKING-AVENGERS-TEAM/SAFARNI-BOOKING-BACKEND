declare global {
  namespace Express {
    interface Request {
      /**
       * Raw request body bytes, captured by the `verify` callback passed
       * to express.json() in app.ts — BEFORE JSON parsing runs. Only
       * webhook.controller.ts should read this; every other route should
       * keep using the normal parsed `req.body`.
       */
      rawBody?: Buffer;
    }
  }
}

export {};
