import type { Knex } from "knex";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { env } from "../../src/env/index.js";

export async function seed(knex: Knex): Promise<void> {
  const existingAdmin = await knex("users")
    .where({ email: "admin@laveai.com" })
    .first();

  if (!existingAdmin) {
    const password = env.ADMIN_PASSWORD || "admin123";
    const password_hash = await bcrypt.hash(password, 10);

    await knex("users").insert({
      id: randomUUID(),
      name: "Admin Lavanderia",
      email: "admin@laveai.com",
      password_hash,
      role: "admin",
    });

    console.log("Admin seed criado: admin@laveai.com / admin123");
  } else {
    console.log("Admin ja existe, seed ignorada.");
  }
}
