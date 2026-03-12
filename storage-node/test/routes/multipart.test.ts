import { test } from "node:test";
import * as assert from "node:assert";
import path from "node:path";
import { promises as fsPromises } from "node:fs";
import { build } from "../helper";
import { MultipartService } from "../../src/services/multipart/MultipartService";

test("multipart initiate/upload/complete flow", async (t) => {
  const app = await build(t);

  const bucket = `multipart-bucket-${Date.now()}`;
  const objectKey = "folder/object.txt";
  let uploadId = "";

  t.after(async () => {
    MultipartService.getInstance().resetForTests();
    await fsPromises.rm(path.join(process.cwd(), "uploads", bucket), {
      recursive: true,
      force: true,
    });
    if (uploadId) {
      await fsPromises.rm(
        path.join(process.cwd(), "uploads", ".multipart", uploadId),
        {
          recursive: true,
          force: true,
        },
      );
    }
  });

  const initiateRes = await app.inject({
    method: "POST",
    url: "/multipart/initiate",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      bucket,
      objectKey,
      contentType: "text/plain",
    },
  });

  assert.strictEqual(initiateRes.statusCode, 201);
  const initiatePayload = JSON.parse(initiateRes.payload);
  uploadId = initiatePayload.data.uploadId as string;

  const uploadPart2Res = await app.inject({
    method: "PUT",
    url: `/multipart/${uploadId}/2`,
    headers: {
      "content-type": "application/octet-stream",
    },
    payload: Buffer.from("World"),
  });
  assert.strictEqual(uploadPart2Res.statusCode, 200);

  const uploadPart1Res = await app.inject({
    method: "PUT",
    url: `/multipart/${uploadId}/1`,
    headers: {
      "content-type": "application/octet-stream",
    },
    payload: Buffer.from("Hello "),
  });
  assert.strictEqual(uploadPart1Res.statusCode, 200);

  // ?�일 partNumber ?�업로드(??��?�기) ?�용
  const reuploadPart2Res = await app.inject({
    method: "PUT",
    url: `/multipart/${uploadId}/2`,
    headers: {
      "content-type": "application/octet-stream",
    },
    payload: Buffer.from("Copilot"),
  });
  assert.strictEqual(reuploadPart2Res.statusCode, 200);

  const completeRes = await app.inject({
    method: "POST",
    url: `/multipart/${uploadId}/complete`,
  });

  assert.strictEqual(completeRes.statusCode, 200);
  const completePayload = JSON.parse(completeRes.payload);
  assert.strictEqual(completePayload.success, true);
  assert.strictEqual(completePayload.data.partCount, 2);

  const finalPath = path.join(process.cwd(), "uploads", bucket, objectKey);
  const content = await fsPromises.readFile(finalPath, "utf-8");
  assert.strictEqual(content, "Hello Copilot");

  const partDir = path.join(process.cwd(), "uploads", ".multipart", uploadId, "parts");
  await assert.rejects(() => fsPromises.access(partDir));
});

test("multipart abort returns 200 and invalidates uploadId", async (t) => {
  const app = await build(t);

  const bucket = `multipart-abort-bucket-${Date.now()}`;
  const objectKey = "abort.txt";
  let uploadId = "";

  t.after(async () => {
    MultipartService.getInstance().resetForTests();
    await fsPromises.rm(path.join(process.cwd(), "uploads", bucket), {
      recursive: true,
      force: true,
    });
    if (uploadId) {
      await fsPromises.rm(
        path.join(process.cwd(), "uploads", ".multipart", uploadId),
        {
          recursive: true,
          force: true,
        },
      );
    }
  });

  const initiateRes = await app.inject({
    method: "POST",
    url: "/multipart/initiate",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      bucket,
      objectKey,
    },
  });

  assert.strictEqual(initiateRes.statusCode, 201);
  uploadId = JSON.parse(initiateRes.payload).data.uploadId as string;

  const abortRes = await app.inject({
    method: "DELETE",
    url: `/multipart/${uploadId}`,
  });

  assert.strictEqual(abortRes.statusCode, 200);

  const completeRes = await app.inject({
    method: "POST",
    url: `/multipart/${uploadId}/complete`,
  });

  assert.strictEqual(completeRes.statusCode, 404);
});

test("multipart invalid partNumber returns 400", async (t) => {
  const app = await build(t);

  const bucket = `multipart-invalid-bucket-${Date.now()}`;
  let uploadId = "";

  t.after(async () => {
    MultipartService.getInstance().resetForTests();
    await fsPromises.rm(path.join(process.cwd(), "uploads", bucket), {
      recursive: true,
      force: true,
    });
    if (uploadId) {
      await fsPromises.rm(
        path.join(process.cwd(), "uploads", ".multipart", uploadId),
        {
          recursive: true,
          force: true,
        },
      );
    }
  });

  const initiateRes = await app.inject({
    method: "POST",
    url: "/multipart/initiate",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      bucket,
      objectKey: "invalid.txt",
    },
  });

  uploadId = JSON.parse(initiateRes.payload).data.uploadId as string;

  const uploadRes = await app.inject({
    method: "PUT",
    url: `/multipart/${uploadId}/0`,
    headers: {
      "content-type": "application/octet-stream",
    },
    payload: Buffer.from("bad"),
  });

  assert.strictEqual(uploadRes.statusCode, 400);
});
