import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyReply } from "fastify";

export type ResolvedByteRange =
  | { status: "full" }
  | { status: "partial"; start: number; end: number }
  | { status: "unsatisfiable" };

/**
 * Resolve a single HTTP byte range for a file response.
 * A missing, malformed, or multi-range header serves the full file.
 * An unsatisfiable range is reported as 416.
 */
export function resolveByteRange(
  rangeHeader: string | undefined,
  fileSize: number,
): ResolvedByteRange {
  if (fileSize === 0 || rangeHeader === undefined || rangeHeader.trim() === "") {
    return { status: "full" };
  }

  const trimmed = rangeHeader.trim();
  const separator = trimmed.indexOf("=");
  if (separator === -1) {
    return { status: "full" };
  }

  const unit = trimmed.slice(0, separator).trim();
  if (unit.toLowerCase() !== "bytes") {
    return { status: "full" };
  }

  const spec = trimmed.slice(separator + 1).trim();
  if (spec === "" || spec.includes(",")) {
    // Empty spec is unsatisfiable; multiple ranges are ignored (send 200).
    return spec.includes(",") ? { status: "full" } : { status: "unsatisfiable" };
  }

  const dash = spec.indexOf("-");
  if (dash === -1) {
    return { status: "full" };
  }

  const firstRaw = spec.slice(0, dash);
  const lastRaw = spec.slice(dash + 1);

  if (firstRaw === "") {
    const suffix = Number(lastRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) {
      return { status: "unsatisfiable" };
    }

    const length = Math.min(suffix, fileSize);
    return {
      status: "partial",
      start: fileSize - length,
      end: fileSize - 1,
    };
  }

  const start = Number(firstRaw);
  if (!Number.isInteger(start) || start < 0) {
    return { status: "full" };
  }

  if (start >= fileSize) {
    return { status: "unsatisfiable" };
  }

  if (lastRaw === "") {
    return { status: "partial", start, end: fileSize - 1 };
  }

  const endRaw = Number(lastRaw);
  if (!Number.isInteger(endRaw) || endRaw < 0) {
    return { status: "full" };
  }

  if (endRaw < start) {
    return { status: "unsatisfiable" };
  }

  return {
    status: "partial",
    start,
    end: Math.min(endRaw, fileSize - 1),
  };
}

function firstHeaderValue(
  header: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}

export async function sendRangedFile(
  reply: FastifyReply,
  filePath: string,
  contentType: string,
  rangeHeader: string | string[] | undefined,
): Promise<FastifyReply> {
  let size: number;
  try {
    ({ size } = await stat(filePath));
  } catch {
    return reply.status(404).send({ error: "Not found" });
  }

  const range = resolveByteRange(firstHeaderValue(rangeHeader), size);

  reply.header("Accept-Ranges", "bytes");
  reply.type(contentType);

  if (range.status === "unsatisfiable") {
    return reply
      .status(416)
      .header("Content-Range", `bytes */${size}`)
      .send();
  }

  if (range.status === "partial") {
    const contentLength = range.end - range.start + 1;
    return reply
      .status(206)
      .header("Content-Range", `bytes ${range.start}-${range.end}/${size}`)
      .header("Content-Length", contentLength)
      .send(
        createReadStream(filePath, { start: range.start, end: range.end }),
      );
  }

  return reply
    .status(200)
    .header("Content-Length", size)
    .send(createReadStream(filePath));
}
