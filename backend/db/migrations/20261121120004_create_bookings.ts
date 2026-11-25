import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("bookings", (table) => {
    table.increments("id").primary();

    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    table
      .integer("machine_id")
      .notNullable()
      .references("id")
      .inTable("machines")
      .onDelete("CASCADE");

    table
      .integer("cycle_id")
      .notNullable()
      .references("id")
      .inTable("cycles")
      .onDelete("RESTRICT");

    table.integer("reserved_minutes").notNullable();
    table.integer("grace_minutes").notNullable().defaultTo(0);

    table.string("start_time").notNullable();         // ISO string
    table.string("end_time").notNullable();            // start_time + reserved_minutes
    table.string("effective_end_time").notNullable();  // end_time + grace_minutes

    table.string("actual_start_time").nullable();      // preenchido no check-in
    table.string("actual_end_time").nullable();        // preenchido ao finalizar

    // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
    table.string("status").notNullable().defaultTo("scheduled");

    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.index(["machine_id", "start_time"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("bookings");
}
