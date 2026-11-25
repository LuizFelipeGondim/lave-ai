import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("machine_logs", (table) => {
    table.increments("id").primary();

    table
      .integer("machine_id")
      .nullable()
      .references("id")
      .inTable("machines")
      .onDelete("SET NULL"); // historico preservado mesmo apos exclusao da maquina

    table
      .uuid("admin_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    table.string("machine_name").notNullable();
    // 'created' | 'updated' | 'status_changed' | 'cycle_added' | 'cycle_removed' | 'deleted'
    table.string("action").notNullable();
    table.text("details").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("machine_logs");
}
