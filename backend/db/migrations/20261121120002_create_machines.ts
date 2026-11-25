import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("machines", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable(); // Ex: "Lavadora A", "Secadora 01"
    table.string("type").notNullable();   // 'washer' | 'dryer'
    table.string("status").notNullable().defaultTo("available"); // 'available' | 'in_use' | 'maintenance'
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("machines");
}
