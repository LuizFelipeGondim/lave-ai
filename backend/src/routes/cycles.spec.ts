import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../app.js";
import { db } from "../database.js";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

const request = supertest(app.server);

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request.post("/auth/login").send({ email, password });
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

let adminCookie: string;
let userCookie: string;
let machineId: number;

beforeEach(async () => {
  await app.ready();
  await db("bookings").delete();
  await db("cycles").delete();
  await db("machine_logs").delete();
  await db("machines").delete();
  await db("users").delete();

  await db("users").insert({
    id: randomUUID(),
    name: "Admin",
    email: "admin@laveai.com",
    password_hash: await bcrypt.hash("admin123", 10),
    role: "admin",
  });
  await db("users").insert({
    id: randomUUID(),
    name: "User",
    email: "user@laveai.com",
    password_hash: await bcrypt.hash("user123", 10),
    role: "user",
  });

  adminCookie = await loginAs("admin@laveai.com", "admin123");
  userCookie = await loginAs("user@laveai.com", "user123");

  [machineId] = await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
});

describe("GET /machines/:id/cycles", () => {
  it("deve retornar lista vazia quando a maquina nao tem ciclos", async () => {
    const res = await request
      .get(`/machines/${machineId}/cycles`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("deve retornar apenas os ciclos da maquina especificada", async () => {
    await db("cycles").insert({ machine_id: machineId, name: "Roupa Leve", duration_minutes: 30 });
    const [other] = await db("machines").insert({ name: "Secadora 01", type: "dryer", status: "available" });
    await db("cycles").insert({ machine_id: other, name: "Secagem Rapida", duration_minutes: 40 });

    const res = await request
      .get(`/machines/${machineId}/cycles`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Roupa Leve");
    expect(res.body[0].machine_id).toBe(machineId);
  });

  it("deve retornar 404 para maquina inexistente", async () => {
    const res = await request
      .get("/machines/9999/cycles")
      .set("Cookie", userCookie);
    expect(res.status).toBe(404);
  });

  it("deve retornar 401 sem autenticacao", async () => {
    const res = await request.get(`/machines/${machineId}/cycles`);
    expect(res.status).toBe(401);
  });
});

describe("POST /cycles", () => {
  it("admin deve criar ciclo vinculado a maquina (201)", async () => {
    const res = await request
      .post("/cycles")
      .set("Cookie", adminCookie)
      .send({ machine_id: machineId, name: "Dia a Dia", duration_minutes: 45 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Dia a Dia");
    expect(res.body.machine_id).toBe(machineId);
    expect(res.body.duration_minutes).toBe(45);
  });

  it("deve gravar log 'cycle_added'", async () => {
    await request
      .post("/cycles")
      .set("Cookie", adminCookie)
      .send({ machine_id: machineId, name: "Edredom", duration_minutes: 75 });
    const logs = await db("machine_logs").where({ action: "cycle_added" });
    expect(logs).toHaveLength(1);
    expect(logs[0].details).toContain("Edredom");
  });

  it("deve retornar 400 para machine_id inexistente", async () => {
    const res = await request
      .post("/cycles")
      .set("Cookie", adminCookie)
      .send({ machine_id: 9999, name: "X", duration_minutes: 30 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Maquina nao encontrada.");
  });

  it("deve retornar 400 para duracao invalida", async () => {
    const res = await request
      .post("/cycles")
      .set("Cookie", adminCookie)
      .send({ machine_id: machineId, name: "X", duration_minutes: -1 });
    expect(res.status).toBe(400);
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .post("/cycles")
      .set("Cookie", userCookie)
      .send({ machine_id: machineId, name: "X", duration_minutes: 30 });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /cycles/:id", () => {
  let cycleId: number;

  beforeEach(async () => {
    [cycleId] = await db("cycles").insert({ machine_id: machineId, name: "Roupa Leve", duration_minutes: 30 });
  });

  it("admin deve remover ciclo (204)", async () => {
    const res = await request
      .delete(`/cycles/${cycleId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(204);
    const cycle = await db("cycles").where({ id: cycleId }).first();
    expect(cycle).toBeUndefined();
  });

  it("deve gravar log 'cycle_removed'", async () => {
    await request
      .delete(`/cycles/${cycleId}`)
      .set("Cookie", adminCookie);
    const logs = await db("machine_logs").where({ action: "cycle_removed" });
    expect(logs).toHaveLength(1);
    expect(logs[0].details).toContain("Roupa Leve");
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .delete(`/cycles/${cycleId}`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(403);
  });

  it("deve retornar 404 para ciclo inexistente", async () => {
    const res = await request
      .delete("/cycles/9999")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(404);
  });
});
