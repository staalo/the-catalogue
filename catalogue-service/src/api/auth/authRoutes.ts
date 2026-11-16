import type { FastifyInstance } from "fastify";
import { config } from "../../app/config.js";
import {
  loginUser,
  registerUser,
  resolveSession,
} from "../../modules/auth/authService.js";
import { requireAuth } from "../../modules/auth/middleware.js";
import { AppError } from "../../shared/errors/AppError.js";

interface LoginBody {
  email?: string;
  userName?: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterBody {
  email: string;
  password: string;
  userName?: string;
}

/**
 * Auth routes:
 *   POST /register
 *   POST /userlogin
 *   POST /logout
 *   GET  /getcurrentuser  (auth required)
 *   GET  /pingauth        (auth required)
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /register
  // Body: { email, password, userName? }
  app.post<{ Body: RegisterBody }>("/register", async (request, reply) => {
    const body = request.body ?? ({} as RegisterBody);
    const { email, password, userName } = body;

    if (!email || !password) {
      return reply
        .status(400)
        .send({ error: "email and password are required" });
    }

    try {
      const user = await registerUser({
        email,
        password,
        userName,
      });
      request.session.userId = user.id;
      request.session.email = user.email;
      request.session.userName = user.userName;
      return reply.status(201).send({
        email: user.email,
        userName: user.userName,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /userlogin
  // Body: { email?, userName?, password, rememberMe? }
  // Either email or userName identifies the account; a value in email may
  // itself be a user name.
  app.post<{ Body: LoginBody }>("/userlogin", async (request, reply) => {
    const { email, userName, password, rememberMe } = request.body ?? {};
    const identifier = email?.trim() || userName?.trim();

    if (!identifier || !password) {
      return reply
        .status(400)
        .send({ error: "email or user name and password are required" });
    }

    try {
      const user = await loginUser(identifier, password);
      request.session.userId = user.id;
      request.session.email = user.email;
      request.session.userName = user.userName;
      if (rememberMe) {
        request.session.cookie.maxAge = config.rememberMeTtlMs;
      }
      return reply.send({ email: user.email });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /logout
  app.post("/logout", async (request, reply) => {
    request.session.destroy();
    return reply.send({});
  });

  // GET /getcurrentuser — returns { email, userName } for the active session user
  app.get(
    "/getcurrentuser",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = resolveSession(request.session.userId!);
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return reply.send({ email: user.email, userName: user.userName });
    },
  );

  // GET /pingauth — returns { email } for the active session
  app.get("/pingauth", { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ email: request.session.email ?? null });
  });
}
