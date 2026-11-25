import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { app } from "../app.js";
import { db } from "../database.js";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

const request = supertest(app.server);

beforeEach(async () => {
  await app.ready();
  await db("bookings").delete();
  await db("cycles").delete();
  await db("machine_logs").delete();
  await db("machines").delete();
  await db("users").delete();
});

describe("POST /auth/register", () => {
  it("deve cadastrar um usuario com sucesso (201)", async () => {
    const res = await request.post("/auth/register").send({
      name: "Maria Souza",
      email: "maria@laveai.com",
      password: "senha123",
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Usuario cadastrado com sucesso!");
    expect(res.body.user.role).toBe("user");
    expect(res.body.user.email).toBe("maria@laveai.com");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("deve retornar 409 se o e-mail ja estiver cadastrado", async () => {
    await db("users").insert({
      id: randomUUID(),
      name: "Maria",
      email: "dup@laveai.com",
      password_hash: await bcrypt.hash("123456", 10),
      role: "user",
    });
    const res = await request.post("/auth/register").send({
      name: "Maria2",
      email: "dup@laveai.com",
      password: "123456",
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Este e-mail ja esta cadastrado.");
  });

  it("deve retornar 400 para nome muito curto", async () => {
    const res = await request.post("/auth/register").send({
      name: "A",
      email: "a@laveai.com",
      password: "123456",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("deve retornar 400 para e-mail invalido", async () => {
    const res = await request.post("/auth/register").send({
      name: "Joao",
      email: "nao-e-email",
      password: "123456",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("deve retornar 400 para senha muito curta", async () => {
    const res = await request.post("/auth/register").send({
      name: "Joao",
      email: "joao@laveai.com",
      password: "123",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await db("users").insert({
      id: randomUUID(),
      name: "Maria Souza",
      email: "maria@laveai.com",
      password_hash: await bcrypt.hash("senha123", 10),
      role: "user",
    });
    await db("users").insert({
      id: randomUUID(),
      name: "Admin",
      email: "admin@laveai.com",
      password_hash: await bcrypt.hash("admin123", 10),
      role: "admin",
    });
  });

  it("deve logar usuario comum e retornar role user (200)", async () => {
    const res = await request.post("/auth/login").send({
      email: "maria@laveai.com",
      password: "senha123",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("user");
    expect(res.body.message).toBe("Login realizado com sucesso!");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("deve logar admin e retornar role admin (200)", async () => {
    const res = await request.post("/auth/login").send({
      email: "admin@laveai.com",
      password: "admin123",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
  });

  it("deve retornar 401 para senha incorreta", async () => {
    const res = await request.post("/auth/login").send({
      email: "maria@laveai.com",
      password: "senhaerrada",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("E-mail ou senha incorretos.");
  });

  it("deve retornar 401 para e-mail inexistente", async () => {
    const res = await request.post("/auth/login").send({
      email: "naoexiste@laveai.com",
      password: "senha123",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("E-mail ou senha incorretos.");
  });

  it("deve retornar 400 para payload invalido", async () => {
    const res = await request.post("/auth/login").send({ email: "nao-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/logout", () => {
  it("deve retornar 200 e limpar o cookie", async () => {
    const res = await request.post("/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logout realizado com sucesso.");
  });
});
