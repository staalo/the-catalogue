import type { FastifyInstance } from "fastify";
import {
  loginUser,
  registerUser,
  resolveSession,
} from "../../modules/auth/authService.js";
import { requireAuth } from "../../modules/auth/middleware.js";
import { AppError } from "../../shared/errors/AppError.js";

interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterBody {
  email: string;
  password: string;
  userName?: string;
  moviesPath?: string;
}

/**
 * Auth routes — mirrors the .NET minimal-API endpoints in Program.cs:
 *   POST /register
 *   POST /userlogin
 *   POST /logout
 *   GET  /getcurrentuser  (auth required)
 *   GET  /pingauth        (auth required)
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /register
  // Body: { email, password, userName?, moviesPath? }
  app.post<{ Body: RegisterBody }>("/register", async (request, reply) => {
    const body = request.body ?? ({} as RegisterBody);
    const { email, password, userName, moviesPath } = body;

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
        moviesPath,
      });
      request.session.userId = user.id;
      request.session.email = user.email;
      request.session.userName = user.userName;
      return reply.status(201).send({
        email: user.email,
        userName: user.userName,
        moviesPath: user.moviesPath,
      });
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /userlogin
  // Body: { email, password, rememberMe? }
  app.post<{ Body: LoginBody }>("/userlogin", async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply
        .status(400)
        .send({ error: "email and password are required" });
    }

    try {
      const user = await loginUser(email, password);
      request.session.userId = user.id;
      request.session.email = user.email;
      request.session.userName = user.userName;
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

  // GET /getcurrentuser — returns { email } for the active session user
  app.get(
    "/getcurrentuser",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = resolveSession(request.session.userId!);
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return reply.send({ email: user.email });
    },
  );

  // GET /pingauth — same contract as /getcurrentuser, kept for .NET parity
  app.get("/pingauth", { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ email: request.session.email ?? null });
  });
}
