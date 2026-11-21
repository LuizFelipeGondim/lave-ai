import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("cycle_types", (table) => {
    table.uuid("id").primary();
    table.string("name").notNullable(); // Ex: "Roupa Leve", "Secagem Rápida"
    table.enum("machine_type", ["washer", "dryer"]).notNullable();
    table.integer("duration_minutes").notNullable(); // Ex: 30, 45, 60
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cycle_types");
}