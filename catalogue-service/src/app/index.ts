import { buildServer } from "./server.js";
import { config } from "./config.js";

async function main(): Promise<void> {
  const server = await buildServer();

  try {
    await server.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
