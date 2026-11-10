import fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";

export const app = fastify();

app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
app.register(cookie);
