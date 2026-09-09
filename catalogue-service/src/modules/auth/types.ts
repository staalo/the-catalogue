// Extend @fastify/session's session object with the fields this service stores.
declare module "@fastify/session" {
  interface FastifySessionObject {
    userId?: string;
    email?: string;
    userName?: string;
  }
}

// Required to make this file a module under "moduleDetection": "force"
export {};
