import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../app.js";
import { db } from "../database.js";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

const request = supertest(app.server);

function addMinutes(isoStr: string, minutes: number): string {
  return new Date(new Date(isoStr).getTime() + minutes * 60_000).toISOString();
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request.post("/auth/login").send({ email, password });
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

let adminCookie: string;
let userCookie: string;
let user2Cookie: string;
let userId: string;
let user2Id: string;
let machineId: number;
let maintenanceMachineId: number;
let cycleId: number; // 30 min
let cycle2Id: number; // 60 min
let otherMachineId: number;
let otherCycleId: number;

beforeEach(async () => {
  await app.ready();
  await db("bookings").delete();
  await db("cycles").delete();
  await db("machine_logs").delete();
  await db("machines").delete();
  await db("users").delete();

  userId = randomUUID();
  user2Id = randomUUID();
  const adminId = randomUUID();

  await db("users").insert([
    {
      id: adminId,
      name: "Admin",
      email: "admin@laveai.com",
      password_hash: await bcrypt.hash("admin123", 10),
      role: "admin",
    },
    {
      id: userId,
      name: "Maria",
      email: "maria@laveai.com",
      password_hash: await bcrypt.hash("senha123", 10),
      role: "user",
    },
    {
      id: user2Id,
      name: "Joao",
      email: "joao@laveai.com",
      password_hash: await bcrypt.hash("senha123", 10),
      role: "user",
    },
  ]);

  adminCookie = await loginAs("admin@laveai.com", "admin123");
  userCookie = await loginAs("maria@laveai.com", "senha123");
  user2Cookie = await loginAs("joao@laveai.com", "senha123");

  [machineId] = await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
  [maintenanceMachineId] = await db("machines").insert({ name: "Secadora EM MANUT", type: "dryer", status: "maintenance" });
  [otherMachineId] = await db("machines").insert({ name: "Lavadora B", type: "washer", status: "available" });

  [cycleId] = await db("cycles").insert({ machine_id: machineId, name: "Roupa Leve", duration_minutes: 30 });
  [cycle2Id] = await db("cycles").insert({ machine_id: machineId, name: "Roupa Pesada", duration_minutes: 60 });
  [otherCycleId] = await db("cycles").insert({ machine_id: otherMachineId, name: "Ciclo B", duration_minutes: 45 });
});

// -----------------------------------------------------------------------
// GET /bookings
// -----------------------------------------------------------------------
describe("GET /bookings", () => {
  it("deve retornar lista vazia quando nao ha agendamentos", async () => {
    const res = await request.get("/bookings").set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("deve retornar agendamentos com todos os campos de JOIN", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    await db("bookings").insert({
      user_id: userId,
      machine_id: machineId,
      cycle_id: cycleId,
      reserved_minutes: 30,
      grace_minutes: 10,
      start_time: now,
      end_time: end,
      effective_end_time: eff,
      status: "scheduled",
    });

    const res = await request.get("/bookings").set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const b = res.body[0];
    expect(b.user_name).toBe("Maria");
    expect(b.machine_name).toBe("Lavadora A");
    expect(b.cycle_name).toBe("Roupa Leve");
    expect(b.cycle_duration_minutes).toBe(30);
  });

  it("deve retornar 401 sem autenticacao", async () => {
    const res = await request.get("/bookings");
    expect(res.status).toBe(401);
  });

  it("deve cancelar automaticamente agendamentos expirados ao listar", async () => {
    // Cria um agendamento com effective_end_time no passado
    const past = new Date(Date.now() - 120 * 60_000).toISOString();
    const end = addMinutes(past, 30);
    const eff = addMinutes(end, 10);
    await db("bookings").insert({
      user_id: userId,
      machine_id: machineId,
      cycle_id: cycleId,
      reserved_minutes: 30,
      grace_minutes: 10,
      start_time: past,
      end_time: end,
      effective_end_time: eff,
      status: "scheduled",
    });

    const res = await request.get("/bookings").set("Cookie", userCookie);
    expect(res.status).toBe(200);
    // O agendamento expirado deve ter sido cancelado
    const cancelled = res.body.find((b: any) => b.status === "cancelled");
    expect(cancelled).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// POST /bookings
// -----------------------------------------------------------------------
describe("POST /bookings", () => {
  it("deve criar agendamento com folga +10 min quando reserved === duration (201)", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, start_time: now });
    expect(res.status).toBe(201);
    expect(res.body.grace_minutes).toBe(10);
    expect(res.body.reserved_minutes).toBe(30);
    // effective_end_time = start + 30 + 10 = start + 40 min
    const effEnd = new Date(res.body.effective_end_time).getTime();
    const startT = new Date(res.body.start_time).getTime();
    expect(effEnd - startT).toBe(40 * 60_000);
  });

  it("deve criar agendamento com grace=0 quando reserved > duration", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 40, start_time: now });
    expect(res.status).toBe(201);
    expect(res.body.grace_minutes).toBe(0);
    const effEnd = new Date(res.body.effective_end_time).getTime();
    const startT = new Date(res.body.start_time).getTime();
    expect(effEnd - startT).toBe(40 * 60_000);
  });

  it("deve retornar 400 para maquina em manutencao", async () => {
    const now = new Date().toISOString();
    const [maintCycleId] = await db("cycles").insert({ machine_id: maintenanceMachineId, name: "Rapido", duration_minutes: 30 });
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: maintenanceMachineId, cycle_id: maintCycleId, reserved_minutes: 30, start_time: now });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("manutencao");
  });

  it("deve retornar 400 quando ciclo nao pertence a maquina", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: otherCycleId, reserved_minutes: 45, start_time: now });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("nao pertence");
  });

  it("deve retornar 400 quando reserved_minutes < duration", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 20, start_time: now });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("30");
  });

  it("deve retornar 400 quando reserved_minutes > duration + 15", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 50, start_time: now });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("45");
  });

  it("deve retornar 400 ao tentar criar buraco na fila (horario artificial)", async () => {
    // Cria um primeiro agendamento agora
    const now = new Date().toISOString();
    await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, start_time: now });

    // Tenta agendar 20 minutos depois do effective_end (criando buraco)
    const future = addMinutes(now, 60);
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, start_time: future });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("buracos");
  });

  it("segundo agendamento deve entrar colado ao primeiro na fila", async () => {
    const now = new Date().toISOString();
    const first = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, start_time: now });
    expect(first.status).toBe(201);
    const firstEffEnd = first.body.effective_end_time;

    // Segundo agendamento deve iniciar exatamente no effective_end do primeiro
    const second = await request
      .post("/bookings")
      .set("Cookie", user2Cookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, start_time: firstEffEnd });
    expect(second.status).toBe(201);
    expect(second.body.start_time).toBe(firstEffEnd);
  });

  it("deve encaixar em janela livre quando houver buraco suficiente", async () => {
    // Cria dois agendamentos na fila com gap artificial via insert direto
    const now = new Date();
    const start1 = now.toISOString();
    const end1 = addMinutes(start1, 30);
    const eff1 = addMinutes(end1, 10);
    // Segundo agendamento começa 60 min depois (deixando buraco de 20 min entre eff1 e start2)
    const start2 = addMinutes(eff1, 20);
    const end2 = addMinutes(start2, 30);
    const eff2 = addMinutes(end2, 10);

    await db("bookings").insert([
      { user_id: userId, machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, grace_minutes: 10, start_time: start1, end_time: end1, effective_end_time: eff1, status: "scheduled" },
      { user_id: user2Id, machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, grace_minutes: 10, start_time: start2, end_time: end2, effective_end_time: eff2, status: "scheduled" },
    ]);

    // Cancela o primeiro para criar buraco real
    const bookings = await db("bookings").orderBy("start_time", "asc");
    await db("bookings").where({ id: bookings[0].id }).update({ status: "cancelled" });

    // Novo agendamento deve encaixar no buraco (eff1 -> start2 = 20 min, ciclo=30 nao cabe; mas aqui o buraco e start1 ate start2)
    // O buraco a partir de now ate start2 e grande o suficiente para um ciclo de 30+10=40 min
    // Neste caso candidate = now, buraco = now ate start2
    const thirdStart = now.toISOString();
    const third = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: cycleId, reserved_minutes: 30, start_time: thirdStart });
    expect(third.status).toBe(201);
  });

  it("deve retornar 400 para machine_id inexistente", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: 9999, cycle_id: cycleId, reserved_minutes: 30, start_time: now });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("nao encontrada");
  });

  it("deve retornar 400 para cycle_id inexistente", async () => {
    const now = new Date().toISOString();
    const res = await request
      .post("/bookings")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, cycle_id: 9999, reserved_minutes: 30, start_time: now });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Ciclo nao encontrado");
  });
});

// -----------------------------------------------------------------------
// PATCH /bookings/:id/start
// -----------------------------------------------------------------------
describe("PATCH /bookings/:id/start", () => {
  it("deve iniciar ciclo com sucesso (200)", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/start`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
    expect(res.body.actual_start_time).toBeDefined();

    const machine = await db("machines").where({ id: machineId }).first();
    expect(machine.status).toBe("in_use");
  });

  it("deve retornar 403 se nao for o dono", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/start`)
      .set("Cookie", user2Cookie);
    expect(res.status).toBe(403);
  });

  it("deve retornar 400 se start_time ainda nao chegou", async () => {
    const future = addMinutes(new Date().toISOString(), 30);
    const end = addMinutes(future, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: future, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/start`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
  });

  it("deve cancelar e retornar 400 se atrasou alem do limite (anti-atraso)", async () => {
    // effective_end_time muito no passado — ciclo nao cabe mais
    const past = addMinutes(new Date().toISOString(), -50);
    const end = addMinutes(past, 30);
    const eff = addMinutes(end, 10); // effective_end = past - 10 min (passado)
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: past, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/start`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("cancelado");

    const booking = await db("bookings").where({ id }).first();
    expect(booking.status).toBe("cancelled");
  });

  it("deve retornar 400 se ja ha outro in_progress na maquina", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    // Outro booking em progress
    await db("bookings").insert({
      user_id: user2Id, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff, status: "in_progress",
    });
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/start`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("em andamento");
  });

  it("deve retornar 404 para booking inexistente", async () => {
    const res = await request
      .patch("/bookings/9999/start")
      .set("Cookie", userCookie);
    expect(res.status).toBe(404);
  });
});

// -----------------------------------------------------------------------
// PATCH /bookings/:id/finish
// -----------------------------------------------------------------------
describe("PATCH /bookings/:id/finish", () => {
  it("dono deve finalizar ciclo (200)", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff,
      actual_start_time: now, status: "in_progress",
    });
    await db("machines").where({ id: machineId }).update({ status: "in_use" });

    const res = await request
      .patch(`/bookings/${id}/finish`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.actual_end_time).toBeDefined();

    const machine = await db("machines").where({ id: machineId }).first();
    expect(machine.status).toBe("available");
  });

  it("admin deve poder finalizar ciclo de outro usuario", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff,
      actual_start_time: now, status: "in_progress",
    });

    const res = await request
      .patch(`/bookings/${id}/finish`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
  });

  it("deve retornar 403 se outro user tentar finalizar", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff,
      actual_start_time: now, status: "in_progress",
    });

    const res = await request
      .patch(`/bookings/${id}/finish`)
      .set("Cookie", user2Cookie);
    expect(res.status).toBe(403);
  });

  it("deve retornar 400 se booking nao esta in_progress", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/finish`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
  });
});

// -----------------------------------------------------------------------
// PATCH /bookings/:id/cancel
// -----------------------------------------------------------------------
describe("PATCH /bookings/:id/cancel", () => {
  it("dono deve cancelar agendamento scheduled (200)", async () => {
    const future = addMinutes(new Date().toISOString(), 60);
    const end = addMinutes(future, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: future, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/cancel`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("admin deve cancelar agendamento de outro user", async () => {
    const future = addMinutes(new Date().toISOString(), 60);
    const end = addMinutes(future, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: future, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/cancel`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("deve retornar 403 se outro user tentar cancelar", async () => {
    const future = addMinutes(new Date().toISOString(), 60);
    const end = addMinutes(future, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: future, end_time: end, effective_end_time: eff, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${id}/cancel`)
      .set("Cookie", user2Cookie);
    expect(res.status).toBe(403);
  });

  it("deve retornar 400 se booking nao esta scheduled", async () => {
    const now = new Date().toISOString();
    const end = addMinutes(now, 30);
    const eff = addMinutes(end, 10);
    const [id] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: end, effective_end_time: eff,
      actual_start_time: now, status: "in_progress",
    });

    const res = await request
      .patch(`/bookings/${id}/cancel`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("scheduled");
  });
});

// -----------------------------------------------------------------------
// PATCH /bookings/:id/takeover
// -----------------------------------------------------------------------
describe("PATCH /bookings/:id/takeover", () => {
  it("proximo usuario deve assumir a maquina quando anterior atrasou (200)", async () => {
    const now = new Date();
    // Primeiro booking: atrasou — effective_end_time no futuro mas status scheduled (sera cancelado pelo autoCancelExpired)
    const start1 = addMinutes(now.toISOString(), -50); // 50 min atras
    const end1 = addMinutes(start1, 30);
    const eff1 = addMinutes(end1, 10); // eff1 = start1 + 40 min = 10 min no passado... vamos deixar no futuro
    // Para simular o cenário correto: anterior atrasado mas eff1 ainda no futuro
    const eff1Future = addMinutes(now.toISOString(), 10); // 10 min no futuro
    const [prevId] = await db("bookings").insert({
      user_id: user2Id, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: start1, end_time: end1, effective_end_time: eff1Future,
      status: "cancelled", // ja cancelado por atraso
    });

    // Segundo booking (usuario Maria - proximo da fila)
    const start2 = eff1Future;
    const end2 = addMinutes(start2, 30);
    const eff2 = addMinutes(end2, 10);
    const [myId] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: start2, end_time: end2, effective_end_time: eff2, status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${myId}/takeover`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
    expect(res.body.actual_start_time).toBeDefined();

    const machine = await db("machines").where({ id: machineId }).first();
    expect(machine.status).toBe("in_use");
  });

  it("deve retornar 403 se nao for o dono do booking", async () => {
    const now = new Date().toISOString();
    const eff1 = addMinutes(now, 10);
    const [prevId] = await db("bookings").insert({
      user_id: user2Id, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: addMinutes(now, -50), end_time: addMinutes(addMinutes(now, -50), 30), effective_end_time: eff1,
      status: "cancelled",
    });
    const start2 = eff1;
    const [myId] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: start2, end_time: addMinutes(start2, 30), effective_end_time: addMinutes(start2, 40),
      status: "scheduled",
    });

    // user2 tenta assumir booking de Maria
    const res = await request
      .patch(`/bookings/${myId}/takeover`)
      .set("Cookie", user2Cookie);
    expect(res.status).toBe(403);
  });

  it("deve retornar 400 se ja ha um ciclo in_progress na maquina", async () => {
    const now = new Date().toISOString();
    await db("bookings").insert({
      user_id: user2Id, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: addMinutes(now, 30), effective_end_time: addMinutes(now, 40),
      status: "in_progress",
    });
    const [myId] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: addMinutes(now, 40), end_time: addMinutes(now, 70), effective_end_time: addMinutes(now, 80),
      status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${myId}/takeover`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("andamento");
  });

  it("deve retornar 400 se nao ha agendamento anterior", async () => {
    const now = new Date().toISOString();
    const [myId] = await db("bookings").insert({
      user_id: userId, machine_id: machineId, cycle_id: cycleId,
      reserved_minutes: 30, grace_minutes: 10,
      start_time: now, end_time: addMinutes(now, 30), effective_end_time: addMinutes(now, 40),
      status: "scheduled",
    });

    const res = await request
      .patch(`/bookings/${myId}/takeover`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(400);
  });

  it("deve retornar 404 para booking inexistente", async () => {
    const res = await request
      .patch("/bookings/9999/takeover")
      .set("Cookie", userCookie);
    expect(res.status).toBe(404);
  });
});
