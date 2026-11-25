import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../database.js";
import { authenticate, isAdmin } from "../middlewares/auth.js";

export async function machineRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /machines — Lista todas as maquinas (user e admin)
  // ----------------------------------------------------------------
  app.get(
    "/machines",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const machines = await db("machines").orderBy("id", "asc");
      return reply.status(200).send(machines);
    }
  );

  // ----------------------------------------------------------------
  // POST /machines — Cria maquina (somente admin)
  // ----------------------------------------------------------------
  app.post(
    "/machines",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const bodySchema = z.object({
        name: z.string().min(1, "Nome e obrigatorio."),
        type: z.enum(["washer", "dryer"], { error: "Tipo invalido. Use 'washer' ou 'dryer'." }),
        status: z.enum(["available", "in_use", "maintenance"]).default("available"),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const { name, type, status } = parsed.data;
      const admin = (request as any).user;

      const [id] = await db("machines").insert({ name, type, status });
      const machine = await db("machines").where({ id }).first();

      // Log de auditoria
      await db("machine_logs").insert({
        machine_id: id,
        admin_id: admin.id,
        machine_name: name,
        action: "created",
        details: `Maquina '${name}' (${type}) criada com status '${status}'.`,
      });

      return reply.status(201).send(machine);
    }
  );

  // ----------------------------------------------------------------
  // PUT /machines/:id — Edita nome e tipo (somente admin)
  // ----------------------------------------------------------------
  app.put(
    "/machines/:id",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bodySchema = z.object({
        name: z.string().min(1, "Nome e obrigatorio."),
        type: z.enum(["washer", "dryer"]),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const machine = await db("machines").where({ id }).first();
      if (!machine) {
        return reply.status(404).send({ message: "Maquina nao encontrada." });
      }

      const { name, type } = parsed.data;
      const admin = (request as any).user;

      await db("machines").where({ id }).update({ name, type });
      const updated = await db("machines").where({ id }).first();

      await db("machine_logs").insert({
        machine_id: Number(id),
        admin_id: admin.id,
        machine_name: name,
        action: "updated",
        details: `Maquina atualizada para nome '${name}' e tipo '${type}'.`,
      });

      return reply.status(200).send(updated);
    }
  );

  // ----------------------------------------------------------------
  // PATCH /machines/:id/status — Altera status (somente admin)
  // ----------------------------------------------------------------
  app.patch(
    "/machines/:id/status",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bodySchema = z.object({
        status: z.enum(["available", "maintenance"]),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: "Status invalido. Use 'available' ou 'maintenance'." });
      }

      const machine = await db("machines").where({ id }).first();
      if (!machine) {
        return reply.status(404).send({ message: "Maquina nao encontrada." });
      }

      const { status } = parsed.data;
      const admin = (request as any).user;
      const previousStatus = machine.status;

      await db("machines").where({ id }).update({ status });
      const updated = await db("machines").where({ id }).first();

      await db("machine_logs").insert({
        machine_id: Number(id),
        admin_id: admin.id,
        machine_name: machine.name,
        action: "status_changed",
        details: `Status alterado de ${previousStatus} para ${status}`,
      });

      return reply.status(200).send(updated);
    }
  );

  // ----------------------------------------------------------------
  // DELETE /machines/:id — Remove maquina (somente admin)
  // ----------------------------------------------------------------
  app.delete(
    "/machines/:id",
    { preHandler: [authenticate, isAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const admin = (request as any).user;

      const machine = await db("machines").where({ id }).first();
      if (!machine) {
        return reply.status(404).send({ message: "Maquina nao encontrada." });
      }

      // Grava log ANTES de deletar (para preservar nome e machine_id tornara null por SET NULL)
      await db("machine_logs").insert({
        machine_id: Number(id),
        admin_id: admin.id,
        machine_name: machine.name,
        action: "deleted",
        details: `Maquina '${machine.name}' removida do sistema.`,
      });

      await db("machines").where({ id }).delete();

      return reply.status(204).send();
    }
  );
}
