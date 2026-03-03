import { MySQLPromisePool } from "@fastify/mysql";
import type { Database } from "better-sqlite3";
import type { ReplicationQueueRepository } from "../repository/replicationQueue";
import type { Server as TusServer } from "tus-node-server";

declare module "fastify" {
  interface FastifyInstance {
    mysql: MySQLPromisePool;
    db: InstanceType<typeof Database>;
    replicationQueue: ReplicationQueueRepository;
    tusServer: TusServer;
    resumableTusServer: TusServer;
  }
}