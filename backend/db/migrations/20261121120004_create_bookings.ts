import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("bookings", (table) => {
    table.uuid("id").primary();

    // Relacionamentos
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("machine_id")
      .notNullable()
      .references("id")
      .inTable("machines")
      .onDelete("CASCADE");
    table
      .uuid("cycle_type_id")
      .notNullable()
      .references("id")
      .inTable("cycle_types")
      .onDelete("RESTRICT");

    // Janela agendada (calculada no momento da reserva: start + duration_minutes)
    table.timestamp("scheduled_start_at").notNullable();
    table.timestamp("scheduled_end_at").notNullable();

    // Execução real (preenchidas conforme o morador interage com a máquina)
    table.timestamp("actual_start_at").nullable(); // Momento do Check-in
    table.timestamp("actual_end_at").nullable();   // actual_start_at + duration_minutes
    table.timestamp("picked_up_at").nullable();    // Quando retirou a roupa

    // Controle do ciclo de vida da reserva
    table
      .enum("status", [
        "scheduled",       // Agendado, aguardando horário/check-in
        "in_progress",     // Check-in feito, máquina rodando
        "awaiting_pickup", // Ciclo acabou, roupa ainda dentro
        "completed",       // Roupa retirada, fluxo encerrado
        "cancelled",       // Cancelado pelo morador/admin
        "expired_delay",   // Bloqueado por atraso (perda de janela)
      ])
      .notNullable()
      .defaultTo("scheduled");

    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Índices para acelerar a busca da agenda do dia e verificação de conflitos
    table.index(["machine_id", "scheduled_start_at", "scheduled_end_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("bookings");
}