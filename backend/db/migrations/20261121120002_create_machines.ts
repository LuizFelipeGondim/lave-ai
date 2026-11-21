import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("machines", (table) => {
    table.uuid("id").primary();
    table.string("name").notNullable(); // Ex: "Lavadora 01", "Secadora 02"
    table.enum("type", ["washer", "dryer"]).notNullable();
    table
      .enum("admin_status", ["active", "maintenance"])
      .notNullable()
      .defaultTo("active");
    table
      .enum("operational_status", [
        "available",       // Livre
        "reserved",        // Reservada (aguardando check-in)
        "in_use",          // Lavando / Secando
        "awaiting_pickup", // Ciclo concluído aguardando retirada
      ])
      .notNullable()
      .defaultTo("available");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("machines");
}