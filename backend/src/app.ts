import fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth.js";
import { machineRoutes } from "./routes/machines.js";
import { cycleRoutes } from "./routes/cycles.js";
import { bookingRoutes } from "./routes/bookings.js";
import { machineLogRoutes } from "./routes/machine-logs.js";

export const app = fastify();

app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(cookie);

// Rotas
app.register(authRoutes);
app.register(machineRoutes);
app.register(cycleRoutes);
app.register(bookingRoutes);
app.register(machineLogRoutes);
