import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../database.js";

/**
 * Verifica se a requisicao tem um cookie sessionId valido (usuario autenticado).
 * Injeta request.user com os dados do usuario.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies?.sessionId;

  if (!sessionId) {
    return reply.status(401).send({ message: "Nao autenticado." });
  }

  const user = await db("users").where({ id: sessionId }).first();

  if (!user) {
    return reply.status(401).send({ message: "Sessao invalida." });
  }

  // Injeta no request para uso nas rotas
  (request as any).user = user;
}

/**
 * Verifica se o usuario autenticado e admin.
 * Deve ser usado APOS o middleware authenticate.
 */
export async function isAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = (request as any).user;

  if (!user || user.role !== "admin") {
    return reply.status(403).send({ message: "Acesso restrito a administradores." });
  }
}
