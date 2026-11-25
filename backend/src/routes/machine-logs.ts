import type { FastifyInstance } from "fastify";
import { db } from "../database.js";
import { authenticate, isAdmin } from "../middlewares/auth.js";

export async function machineLogRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /machine-logs — Historico de modificacoes (somente admin)
  // ----------------------------------------------------------------
  app.get(
    "/machine-logs",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const logs = await db("machine_logs")
        .orderBy("created_at", "desc")
        .select("id", "machine_id", "admin_id", "machine_name", "action", "details", "created_at");

      return reply.status(200).send(logs);
    }
  );
}
