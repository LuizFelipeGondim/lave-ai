import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../database.js";
import { authenticate, isAdmin } from "../middlewares/auth.js";

export async function cycleRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /machines/:id/cycles — Ciclos de uma maquina (user e admin)
  // ----------------------------------------------------------------
  app.get(
    "/machines/:id/cycles",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const machine = await db("machines").where({ id }).first();
      if (!machine) {
        return reply.status(404).send({ message: "Maquina nao encontrada." });
      }

      const cycles = await db("cycles").where({ machine_id: Number(id) }).orderBy("id", "asc");
      return reply.status(200).send(cycles);
    }
  );

  // ----------------------------------------------------------------
  // POST /cycles — Cria ciclo vinculado a uma maquina (somente admin)
  // ----------------------------------------------------------------
  app.post(
    "/cycles",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const bodySchema = z.object({
        machine_id: z.number().int().positive("machine_id invalido."),
        name: z.string().min(1, "Nome do ciclo e obrigatorio."),
        duration_minutes: z.number().int().positive("Duracao deve ser inteiro positivo."),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const { machine_id, name, duration_minutes } = parsed.data;
      const admin = (request as any).user;

      const machine = await db("machines").where({ id: machine_id }).first();
      if (!machine) {
        return reply.status(400).send({ message: "Maquina nao encontrada." });
      }

      const [id] = await db("cycles").insert({ machine_id, name, duration_minutes });
      const cycle = await db("cycles").where({ id }).first();

      await db("machine_logs").insert({
        machine_id,
        admin_id: admin.id,
        machine_name: machine.name,
        action: "cycle_added",
        details: `Ciclo '${name} (${duration_minutes} min)' adicionado.`,
      });

      return reply.status(201).send(cycle);
    }
  );

  // ----------------------------------------------------------------
  // DELETE /cycles/:id — Remove ciclo (somente admin)
  // ----------------------------------------------------------------
  app.delete(
    "/cycles/:id",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const admin = (request as any).user;

      const cycle = await db("cycles").where({ id }).first();
      if (!cycle) {
        return reply.status(404).send({ message: "Ciclo nao encontrado." });
      }

      const machine = await db("machines").where({ id: cycle.machine_id }).first();

      await db("cycles").where({ id }).delete();

      await db("machine_logs").insert({
        machine_id: cycle.machine_id,
        admin_id: admin.id,
        machine_name: machine?.name ?? "Maquina desconhecida",
        action: "cycle_removed",
        details: `Ciclo '${cycle.name} (${cycle.duration_minutes} min)' removido.`,
      });

      return reply.status(204).send();
    }
  );
}
