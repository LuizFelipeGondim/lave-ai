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

beforeEach(async () => {
  await app.ready();
  await db("bookings").delete();
  await db("cycles").delete();
  await db("machine_logs").delete();
  await db("machines").delete();
  await db("users").delete();

  const adminId = randomUUID();
  await db("users").insert({
    id: adminId,
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

  // Insere alguns logs de auditoria
  const [machineId] = await db("machines").insert({ name: "Lavadora A", type: "washer", status: "available" });
  await db("machine_logs").insert({
    machine_id: machineId,
    admin_id: adminId,
    machine_name: "Lavadora A",
    action: "created",
    details: "Maquina criada.",
  });
  await db("machine_logs").insert({
    machine_id: machineId,
    admin_id: adminId,
    machine_name: "Lavadora A",
    action: "status_changed",
    details: "Status alterado de available para maintenance",
  });

  adminCookie = await loginAs("admin@laveai.com", "admin123");
  userCookie = await loginAs("user@laveai.com", "user123");
});

describe("GET /machine-logs", () => {
  it("admin deve receber o historico completo (200)", async () => {
    const res = await request
      .get("/machine-logs")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Mais recente primeiro
    expect(res.body[0].action).toBe("status_changed");
    expect(res.body[1].action).toBe("created");
  });

  it("cada log deve ter os campos esperados pelo frontend", async () => {
    const res = await request
      .get("/machine-logs")
      .set("Cookie", adminCookie);
    const log = res.body[0];
    expect(log).toHaveProperty("id");
    expect(log).toHaveProperty("machine_id");
    expect(log).toHaveProperty("admin_id");
    expect(log).toHaveProperty("machine_name");
    expect(log).toHaveProperty("action");
    expect(log).toHaveProperty("details");
    expect(log).toHaveProperty("created_at");
  });

  it("usuario comum deve receber 403", async () => {
    const res = await request
      .get("/machine-logs")
      .set("Cookie", userCookie);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Acesso restrito a administradores.");
  });

  it("deve retornar 401 sem autenticacao", async () => {
    const res = await request.get("/machine-logs");
    expect(res.status).toBe(401);
  });
});
