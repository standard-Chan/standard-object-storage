import Fastify from "fastify";
import { app, options } from "./app";

const server = Fastify({
  logger: {
    level: "info",
  },
  ...options,
});

server.register(app, options);

server.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`Server listening at ${address}`);
});
