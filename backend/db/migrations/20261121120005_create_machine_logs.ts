import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("machine_logs", (table) => {
    table.increments("id").primary();

    // Deve ser uuid para bater com o tipo de machines.id
    table
      .uuid("machine_id")
      .nullable()
      .references("id")
      .inTable("machines")
      .onDelete("SET NULL");

    table
      .uuid("admin_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    table.string("machine_name").notNullable();
    table.string("action").notNullable(); // Ex: 'created', 'updated', 'status_changed', 'cycle_added', 'cycle_removed', 'deleted'
    table.text("details").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // Índice para otimizar a busca cronológica no painel do Admin
    table.index(["created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("machine_logs");
}

