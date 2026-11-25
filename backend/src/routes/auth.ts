import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../database.js";

export async function authRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // POST /auth/register — Cadastro de usuario comum
  // ----------------------------------------------------------------
  app.post("/auth/register", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
      email: z.string().email("E-mail invalido."),
      password: z.string().min(6, "Senha deve ter ao menos 6 caracteres."),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Dados invalidos.";
      return reply.status(400).send({ message });
    }

    const { name, email, password } = parsed.data;

    const existing = await db("users").where({ email }).first();
    if (existing) {
      return reply.status(409).send({ message: "Este e-mail ja esta cadastrado." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = randomUUID();

    await db("users").insert({ id, name, email, password_hash, role: "user" });

    return reply.status(201).send({
      message: "Usuario cadastrado com sucesso!",
      user: { id, name, email, role: "user" },
    });
  });

  // ----------------------------------------------------------------
  // POST /auth/login — Autenticacao
  // ----------------------------------------------------------------
  app.post("/auth/login", async (request, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Dados invalidos." });
    }

    const { email, password } = parsed.data;

    const user = await db("users").where({ email }).first();
    if (!user) {
      return reply.status(401).send({ message: "E-mail ou senha incorretos." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return reply.status(401).send({ message: "E-mail ou senha incorretos." });
    }

    // Cookie de sessao: sessionId = user.id
    reply.setCookie("sessionId", user.id, {
      path: "/",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return reply.status(200).send({
      message: "Login realizado com sucesso!",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  // ----------------------------------------------------------------
  // POST /auth/logout — Encerra sessao
  // ----------------------------------------------------------------
  app.post("/auth/logout", async (request, reply) => {
    reply.clearCookie("sessionId", { path: "/" });
    return reply.status(200).send({ message: "Logout realizado com sucesso." });
  });
}
