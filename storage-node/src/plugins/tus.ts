import fp from "fastify-plugin";
import { Server as TusServer, EVENTS } from "tus-node-server";
import { join } from "node:path";
import { namingFunction } from "../tus/options";
import { onFileCreated, onUploadComplete } from "../tus/eventHandler";
import CustomFileStore from "../tus/CustomFileStore";
import SqliteConfigstore from "../tus/SqliteConfigstore";
import { TusSessionStore } from "../tus/TusSessionStore";

const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR ?? "uploads";
const TUS_API_ENDPOINT = "/tus/objects";

/**
 * TUS 업로드 플러그인 (uploads/resumable)
 */
export default fp(
  async (fastify) => {
    const uploadBaseDir = join(process.cwd(), UPLOAD_BASE_DIR);
    const configstore = new SqliteConfigstore(fastify.db);

    const options = { path: TUS_API_ENDPOINT, namingFunction };
    const tusServer = new TusServer(options);

    tusServer.datastore = new CustomFileStore({
      directory: uploadBaseDir,
      configstore,
    });

    tusServer.on(EVENTS.EVENT_FILE_CREATED, onFileCreated(fastify));
    tusServer.on(EVENTS.EVENT_UPLOAD_COMPLETE, onUploadComplete(fastify));

    const tusSessionStore = new TusSessionStore(
      fastify.db,
      undefined,
      fastify.log,
    );

    tusSessionStore.startCleanupSchedule();

    fastify.decorate("tusServer", tusServer);
    fastify.decorate("tusSessionStore", tusSessionStore);

    fastify.addHook("onClose", (_instance, done) => {
      tusSessionStore.stopCleanupSchedule();
      done();
    });
  },
  {
    name: "tus",
    fastify: "5.x",
    dependencies: ["sqlite"],
  },
);
