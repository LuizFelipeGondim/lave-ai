import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../app.js";
import { db } from "../database.js";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

const request = supertest(app.server);

// Helpers para autenticar e obter cookies
async function loginAs(email: string, password: string): Promise<string> {
  const res = await request.post("/auth/login").send({ email, password });
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

let adminCookie: string;
let userCookie: string;

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
});

describe("GET /machines", () => {
  it("deve retornar lista vazia quando nao ha maquinas", async () => {
    const res = await request.get("/machines").set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("deve retornar as maquinas cadastradas", async () => {
    await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
    const res = await request.get("/machines").set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Lavadora A");
  });

  it("deve retornar 401 sem autenticacao", async () => {
    const res = await request.get("/machines");
    expect(res.status).toBe(401);
  });
});

describe("POST /machines", () => {
  it("admin deve criar maquina com sucesso (201)", async () => {
    const res = await request
      .post("/machines")
      .set("Cookie", adminCookie)
      .send({ name: "Lavadora A", type: "washer", status: "available" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Lavadora A");
    expect(res.body.type).toBe("washer");
    expect(res.body.id).toBeDefined();
  });

  it("deve gravar log 'created' ao criar maquina", async () => {
    await request
      .post("/machines")
      .set("Cookie", adminCookie)
      .send({ name: "Secadora 01", type: "dryer", status: "available" });
    const logs = await db("machine_logs").where({ action: "created" });
    expect(logs).toHaveLength(1);
    expect(logs[0].machine_name).toBe("Secadora 01");
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .post("/machines")
      .set("Cookie", userCookie)
      .send({ name: "Lavadora A", type: "washer" });
    expect(res.status).toBe(403);
  });

  it("deve retornar 400 para tipo invalido", async () => {
    const res = await request
      .post("/machines")
      .set("Cookie", adminCookie)
      .send({ name: "Maquina X", type: "invalid_type" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });
});

describe("PUT /machines/:id", () => {
  let machineId: number;

  beforeEach(async () => {
    [machineId] = await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
  });

  it("admin deve editar nome e tipo da maquina (200)", async () => {
    const res = await request
      .put(`/machines/${machineId}`)
      .set("Cookie", adminCookie)
      .send({ name: "Lavadora A1", type: "dryer" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Lavadora A1");
    expect(res.body.type).toBe("dryer");
  });

  it("deve gravar log 'updated'", async () => {
    await request
      .put(`/machines/${machineId}`)
      .set("Cookie", adminCookie)
      .send({ name: "Nova", type: "washer" });
    const logs = await db("machine_logs").where({ action: "updated" });
    expect(logs).toHaveLength(1);
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .put(`/machines/${machineId}`)
      .set("Cookie", userCookie)
      .send({ name: "Novo", type: "washer" });
    expect(res.status).toBe(403);
  });

  it("deve retornar 404 para maquina inexistente", async () => {
    const res = await request
      .put("/machines/9999")
      .set("Cookie", adminCookie)
      .send({ name: "X", type: "washer" });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /machines/:id/status", () => {
  let machineId: number;

  beforeEach(async () => {
    [machineId] = await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
  });

  it("admin deve alterar status para maintenance (200)", async () => {
    const res = await request
      .patch(`/machines/${machineId}/status`)
      .set("Cookie", adminCookie)
      .send({ status: "maintenance" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("maintenance");
  });

  it("deve gravar log 'status_changed'", async () => {
    await request
      .patch(`/machines/${machineId}/status`)
      .set("Cookie", adminCookie)
      .send({ status: "maintenance" });
    const logs = await db("machine_logs").where({ action: "status_changed" });
    expect(logs).toHaveLength(1);
    expect(logs[0].details).toContain("available");
    expect(logs[0].details).toContain("maintenance");
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .patch(`/machines/${machineId}/status`)
      .set("Cookie", userCookie)
      .send({ status: "maintenance" });
    expect(res.status).toBe(403);
  });

  it("deve retornar 400 para status invalido", async () => {
    const res = await request
      .patch(`/machines/${machineId}/status`)
      .set("Cookie", adminCookie)
      .send({ status: "in_use" }); // in_use nao e permitido aqui
    expect(res.status).toBe(400);
  });

  it("deve retornar 404 para maquina inexistente", async () => {
    const res = await request
      .patch("/machines/9999/status")
      .set("Cookie", adminCookie)
      .send({ status: "maintenance" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /machines/:id", () => {
  let machineId: number;

  beforeEach(async () => {
    [machineId] = await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
  });

  it("admin deve remover maquina (204)", async () => {
    const res = await request
      .delete(`/machines/${machineId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(204);
    const machine = await db("machines").where({ id: machineId }).first();
    expect(machine).toBeUndefined();
  });

  it("deve gravar log 'deleted' antes de remover", async () => {
    await request
      .delete(`/machines/${machineId}`)
      .set("Cookie", adminCookie);
    const logs = await db("machine_logs").where({ action: "deleted" });
    expect(logs).toHaveLength(1);
    expect(logs[0].machine_name).toBe("Lavadora A");
    // machine_id deve ter sido SET NULL
    expect(logs[0].machine_id).toBeNull();
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .delete(`/machines/${machineId}`)
      .set("Cookie", userCookie);
    expect(res.status).toBe(403);
  });

  it("deve retornar 404 para maquina inexistente", async () => {
    const res = await request
      .delete("/machines/9999")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(404);
  });
});
