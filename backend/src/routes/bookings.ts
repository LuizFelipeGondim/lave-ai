import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../database.js";
import { authenticate, isAdmin } from "../middlewares/auth.js";

// Converte string ISO em timestamp ms
function toMs(isoStr: string): number {
  return new Date(isoStr).getTime();
}

function addMinutes(isoStr: string, minutes: number): string {
  return new Date(toMs(isoStr) + minutes * 60_000).toISOString();
}

/**
 * Cancela automaticamente agendamentos 'scheduled' que ultrapassaram o prazo.
 * Um agendamento expira quando: now + cycle_duration_minutes > effective_end_time
 * (ou seja, o ciclo nao cabe mais dentro da janela reservada).
 */
async function autoCancelExpired(machineId?: number): Promise<void> {
  const now = new Date().toISOString();

  // Busca todos os 'scheduled' com join no ciclo para saber a duracao
  let query = db("bookings")
    .join("cycles", "bookings.cycle_id", "cycles.id")
    .where("bookings.status", "scheduled")
    .select(
      "bookings.id",
      "bookings.effective_end_time",
      "cycles.duration_minutes"
    );

  if (machineId !== undefined) {
    query = query.where("bookings.machine_id", machineId);
  }

  const scheduled = await query;

  for (const booking of scheduled) {
    const wouldEnd = new Date(toMs(now) + booking.duration_minutes * 60_000).toISOString();
    if (wouldEnd > booking.effective_end_time) {
      await db("bookings").where({ id: booking.id }).update({ status: "cancelled" });
    }
  }
}

export async function bookingRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /bookings — Todos os agendamentos com JOINs (user e admin)
  // ----------------------------------------------------------------
  app.get(
    "/bookings",
    { preHandler: [authenticate] },
    async (request, reply) => {
      // Cancela automaticamente expirados antes de retornar
      await autoCancelExpired();

      const bookings = await db("bookings")
        .join("users", "bookings.user_id", "users.id")
        .join("machines", "bookings.machine_id", "machines.id")
        .join("cycles", "bookings.cycle_id", "cycles.id")
        .select(
          "bookings.id",
          "bookings.user_id",
          "users.name as user_name",
          "bookings.machine_id",
          "machines.name as machine_name",
          "bookings.cycle_id",
          "cycles.name as cycle_name",
          "cycles.duration_minutes as cycle_duration_minutes",
          "bookings.reserved_minutes",
          "bookings.grace_minutes",
          "bookings.start_time",
          "bookings.end_time",
          "bookings.effective_end_time",
          "bookings.actual_start_time",
          "bookings.actual_end_time",
          "bookings.status",
          "bookings.created_at"
        )
        .orderBy("bookings.start_time", "asc");

      return reply.status(200).send(bookings);
    }
  );

  // ----------------------------------------------------------------
  // POST /bookings — Cria agendamento com todas as regras de negocio
  // ----------------------------------------------------------------
  app.post(
    "/bookings",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const bodySchema = z.object({
        machine_id: z.number().int().positive(),
        cycle_id: z.number().int().positive(),
        reserved_minutes: z.number().int().positive(),
        start_time: z.string(),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const { machine_id, cycle_id, reserved_minutes, start_time } = parsed.data;
      const user = (request as any).user;
      const now = new Date().toISOString();

      // Regra 1: Maquina existe e nao esta em manutencao
      const machine = await db("machines").where({ id: machine_id }).first();
      if (!machine) {
        return reply.status(400).send({ message: "Maquina nao encontrada." });
      }
      if (machine.status === "maintenance") {
        return reply.status(400).send({ message: "Esta maquina esta em manutencao e nao pode ser agendada." });
      }

      // Regra 2: Ciclo existe e pertence a maquina
      const cycle = await db("cycles").where({ id: cycle_id }).first();
      if (!cycle) {
        return reply.status(400).send({ message: "Ciclo nao encontrado." });
      }
      if (cycle.machine_id !== machine_id) {
        return reply.status(400).send({ message: "Este ciclo nao pertence a maquina selecionada." });
      }

      // Regra 3: Limite de reserva
      const D = cycle.duration_minutes;
      if (reserved_minutes < D || reserved_minutes > D + 15) {
        return reply.status(400).send({
          message: `Tempo de reserva deve ser entre ${D} e ${D + 15} minutos para este ciclo.`,
        });
      }

      // Regra 4: Folga automatica
      const grace_minutes = reserved_minutes === D ? 10 : 0;
      const total_minutes = reserved_minutes + grace_minutes;

      // Cancela expirados antes de calcular a fila
      await autoCancelExpired(machine_id);

      // Regra 5: Fila sequencial sem buracos (First-Fit a partir de now)
      const activeBookings = await db("bookings")
        .where("machine_id", machine_id)
        .whereIn("status", ["in_progress", "scheduled"])
        .orderBy("start_time", "asc")
        .select("start_time", "effective_end_time");

      let candidate = now;

      for (const booking of activeBookings) {
        // Verifica se o candidato cabe no buraco ANTES deste booking
        if (candidate < booking.start_time) {
          const wouldEnd = new Date(toMs(candidate) + total_minutes * 60_000).toISOString();
          if (wouldEnd <= booking.start_time) {
            // Encaixa no buraco
            break;
          }
        }
        // Nao coube; avanca candidate para apos este booking
        const nextCandidate = booking.effective_end_time;
        if (nextCandidate > candidate) {
          candidate = nextCandidate;
        }
      }

      // Tolerancia de ~2 minutos para diferenca de relogio/rede quando candidate === now
      const candidateMs = toMs(candidate);
      const startMs = toMs(start_time);
      const nowMs = toMs(now);

      const isNowSlot = Math.abs(candidateMs - nowMs) < 2 * 60_000;
      const tolerance = isNowSlot ? 2 * 60_000 : 0;

      if (Math.abs(startMs - candidateMs) > tolerance) {
        return reply.status(400).send({
          message: `O horario de inicio deve ser ${new Date(candidateMs).toISOString()}. Nao e permitido deixar buracos na fila.`,
        });
      }

      // Calcula horarios finais usando o candidate (nao o start_time enviado)
      const finalStart = new Date(candidateMs).toISOString();
      const end_time = addMinutes(finalStart, reserved_minutes);
      const effective_end_time = addMinutes(end_time, grace_minutes);

      const [id] = await db("bookings").insert({
        user_id: user.id,
        machine_id,
        cycle_id,
        reserved_minutes,
        grace_minutes,
        start_time: finalStart,
        end_time,
        effective_end_time,
        actual_start_time: null,
        actual_end_time: null,
        status: "scheduled",
      });

      const newBooking = await db("bookings")
        .join("users", "bookings.user_id", "users.id")
        .join("machines", "bookings.machine_id", "machines.id")
        .join("cycles", "bookings.cycle_id", "cycles.id")
        .where("bookings.id", id)
        .select(
          "bookings.id",
          "bookings.user_id",
          "users.name as user_name",
          "bookings.machine_id",
          "machines.name as machine_name",
          "bookings.cycle_id",
          "cycles.name as cycle_name",
          "cycles.duration_minutes as cycle_duration_minutes",
          "bookings.reserved_minutes",
          "bookings.grace_minutes",
          "bookings.start_time",
          "bookings.end_time",
          "bookings.effective_end_time",
          "bookings.actual_start_time",
          "bookings.actual_end_time",
          "bookings.status",
          "bookings.created_at"
        )
        .first();

      return reply.status(201).send(newBooking);
    }
  );

  // ----------------------------------------------------------------
  // PATCH /bookings/:id/start — Inicia o ciclo (Check-in)
  // ----------------------------------------------------------------
  app.patch(
    "/bookings/:id/start",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user;
      const now = new Date().toISOString();

      const booking = await db("bookings")
        .join("cycles", "bookings.cycle_id", "cycles.id")
        .where("bookings.id", id)
        .select(
          "bookings.id",
          "bookings.user_id",
          "bookings.machine_id",
          "bookings.status",
          "bookings.start_time",
          "bookings.effective_end_time",
          "cycles.duration_minutes"
        )
        .first();

      if (!booking) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      // Apenas o dono pode iniciar
      if (booking.user_id !== user.id) {
        return reply.status(403).send({ message: "Voce nao tem permissao para iniciar este agendamento." });
      }

      if (booking.status !== "scheduled") {
        return reply.status(400).send({ message: "Este agendamento nao pode ser iniciado." });
      }

      // Verifica se o horario de inicio ja chegou
      if (now < booking.start_time) {
        return reply.status(400).send({ message: "O horario de inicio ainda nao chegou." });
      }

      // Verifica se ja tem outro in_progress nesta maquina
      const inProgress = await db("bookings")
        .where({ machine_id: booking.machine_id, status: "in_progress" })
        .first();
      if (inProgress) {
        return reply.status(400).send({ message: "Ja ha um ciclo em andamento nesta maquina." });
      }

      // Regra Anti-Atraso: now + duracao_ciclo <= effective_end_time
      const wouldEnd = new Date(toMs(now) + booking.duration_minutes * 60_000).toISOString();
      if (wouldEnd > booking.effective_end_time) {
        await db("bookings").where({ id }).update({ status: "cancelled" });
        return reply.status(400).send({
          message: "Atraso acima do limite do ciclo. Seu agendamento foi cancelado.",
        });
      }

      await db("bookings").where({ id }).update({
        status: "in_progress",
        actual_start_time: now,
      });
      await db("machines").where({ id: booking.machine_id }).update({ status: "in_use" });

      const updated = await db("bookings").where({ id }).first();
      return reply.status(200).send(updated);
    }
  );

  // ----------------------------------------------------------------
  // PATCH /bookings/:id/finish — Finaliza o ciclo (dono ou admin)
  // ----------------------------------------------------------------
  app.patch(
    "/bookings/:id/finish",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user;
      const now = new Date().toISOString();

      const booking = await db("bookings").where({ id }).first();
      if (!booking) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      if (booking.user_id !== user.id && user.role !== "admin") {
        return reply.status(403).send({ message: "Voce nao tem permissao para finalizar este agendamento." });
      }

      if (booking.status !== "in_progress") {
        return reply.status(400).send({ message: "Este agendamento nao esta em andamento." });
      }

      await db("bookings").where({ id }).update({
        status: "completed",
        actual_end_time: now,
      });
      await db("machines").where({ id: booking.machine_id }).update({ status: "available" });

      const updated = await db("bookings").where({ id }).first();
      return reply.status(200).send(updated);
    }
  );

  // ----------------------------------------------------------------
  // PATCH /bookings/:id/takeover — Assume a maquina (proximo da fila)
  // ----------------------------------------------------------------
  app.patch(
    "/bookings/:id/takeover",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user;
      const now = new Date().toISOString();

      const booking = await db("bookings").where({ id }).first();
      if (!booking) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      // Cancela expirados em tempo real antes de validar (fix: takeover sem GET /bookings previo)
      await autoCancelExpired(booking.machine_id);

      // Apenas o dono deste agendamento pode fazer takeover
      if (booking.user_id !== user.id) {
        return reply.status(403).send({ message: "Apenas o proximo usuario da fila pode assumir a maquina." });
      }

      // Nenhuma reserva in_progress na maquina
      const inProgress = await db("bookings")
        .where({ machine_id: booking.machine_id, status: "in_progress" })
        .first();
      if (inProgress) {
        return reply.status(400).send({ message: "Ja ha um ciclo em andamento nesta maquina." });
      }

      // Busca todos os agendamentos ativos desta maquina por ordem cronologica
      const allBookings = await db("bookings")
        .where("machine_id", booking.machine_id)
        .whereIn("status", ["scheduled", "cancelled", "in_progress"])
        .orderBy("start_time", "asc")
        .select("id", "status", "start_time", "effective_end_time", "user_id");

      // Encontra a posicao deste booking na lista
      const myIndex = allBookings.findIndex((b: any) => b.id === Number(id));
      if (myIndex <= 0) {
        return reply.status(400).send({
          message: "Nao ha agendamento anterior para assumir.",
        });
      }

      const prevBooking = allBookings[myIndex - 1];

      // O anterior deve estar cancelado
      if (prevBooking.status !== "cancelled") {
        return reply.status(400).send({
          message: "O agendamento anterior nao foi cancelado por atraso.",
        });
      }

      // A janela do anterior ainda deve cobrir o horario atual
      if (prevBooking.effective_end_time <= now) {
        return reply.status(400).send({
          message: "A janela do agendamento anterior ja expirou.",
        });
      }

      // Verifica que este booking e o IMEDIATAMENTE proximo (nenhum outro scheduled entre eles)
      const scheduledBetween = allBookings.slice(0, myIndex).some(
        (b: any) => b.status === "scheduled"
      );
      if (scheduledBetween) {
        return reply.status(403).send({
          message: "Apenas o proximo usuario da fila pode assumir a maquina.",
        });
      }

      // Antecipa o agendamento
      const newEndTime = addMinutes(now, booking.reserved_minutes);
      const newEffectiveEnd = addMinutes(newEndTime, booking.grace_minutes);

      await db("bookings").where({ id }).update({
        status: "in_progress",
        actual_start_time: now,
        start_time: now,
        end_time: newEndTime,
        effective_end_time: newEffectiveEnd,
      });

      await db("machines").where({ id: booking.machine_id }).update({ status: "in_use" });

      const updated = await db("bookings").where({ id }).first();
      return reply.status(200).send(updated);
    }
  );

  // ----------------------------------------------------------------
  // PATCH /bookings/:id/cancel — Cancela agendamento futuro (dono ou admin)
  // ----------------------------------------------------------------
  app.patch(
    "/bookings/:id/cancel",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user;

      const booking = await db("bookings").where({ id }).first();
      if (!booking) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      if (booking.user_id !== user.id && user.role !== "admin") {
        return reply.status(403).send({ message: "Voce nao tem permissao para cancelar este agendamento." });
      }

      if (booking.status !== "scheduled") {
        return reply.status(400).send({ message: "Apenas agendamentos com status 'scheduled' podem ser cancelados." });
      }

      await db("bookings").where({ id }).update({ status: "cancelled" });

      const updated = await db("bookings").where({ id }).first();
      return reply.status(200).send(updated);
    }
  );
}
