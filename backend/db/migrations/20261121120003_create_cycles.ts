import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("cycles", (table) => {
    table.increments("id").primary();
    table
      .integer("machine_id")
      .notNullable()
      .references("id")
      .inTable("machines")
      .onDelete("CASCADE");
    table.string("name").notNullable(); // Ex: "Roupa Leve", "Dia a Dia"
    table.integer("duration_minutes").notNullable(); // Ex: 30, 45, 60
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cycles");
}
