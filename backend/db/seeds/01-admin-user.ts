import type { Knex } from "knex";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { env } from "../../src/env/index.js";

export async function seed(knex: Knex): Promise<void> {
  // 1. Cria o Admin padrão se ainda não existir
  const existingAdmin = await knex("users")
    .where({ email: "admin@lavanderia.com" })
    .first();

  if (!existingAdmin) {
    const password = env.ADMIN_PASSWORD || "admin123";
    const password_hash = await bcrypt.hash(password, 10);

    await knex("users").insert({
      id: randomUUID(),
      name: "Admin Lavanderia",
      email: "admin@lavanderia.com",
      password_hash,
      role: "admin", // Importante: define a permissão de administrador
      unit_number: null,
    });
  }

  // 2. Opcional: já deixa os ciclos padrão cadastrados
  const existingCycles = await knex("cycle_types").first();
  if (!existingCycles) {
    await knex("cycle_types").insert([
      { id: randomUUID(), name: "Roupa Leve", machine_type: "washer", duration_minutes: 30 },
      { id: randomUUID(), name: "Dia a Dia", machine_type: "washer", duration_minutes: 45 },
      { id: randomUUID(), name: "Roupa Pesada", machine_type: "washer", duration_minutes: 60 },
      { id: randomUUID(), name: "Secagem Rápida", machine_type: "dryer", duration_minutes: 40 },
    ]);
  }
}