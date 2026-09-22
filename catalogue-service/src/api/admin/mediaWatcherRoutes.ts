/**
 * Media Watcher Routes — admin endpoints for scanning and status checks.
 * All routes require authentication.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import {
  scanMediaDirectory,
  getScanStatus,
  getLatestScanStatus,
} from "../../modules/media-watcher/index.js";

/**
 * Register media watcher routes.
 */
export async function registerMediaWatcherRoutes(
  app: FastifyInstance,
): Promise<void> {
  /**
   * POST /api/admin/media/scan-movies
   * Trigger a scan of the shared movies directory.
   * Returns scan ID and initial status.
   */
  app.post<{
    Reply: {
      scanId?: number;
      status?: string;
      message?: string;
      error?: string;
      details?: string;
    };
  }>(
    "/api/admin/media/scan-movies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userName = request.session.userName ?? request.session.email;
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const result = await scanMediaDirectory(userName, "movies");

        if (!result.success) {
          return reply.status(400).send({
            error: result.message,
          });
        }

        return reply.status(202).send({
          scanId: result.scanId,
          status: "Scan started",
          message: result.message,
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          error: "Failed to start scan",
          details: errorMsg,
        });
      }
    },
  );

  /**
   * POST /api/admin/media/scan-tv
   * Trigger a scan of the shared TV shows directory.
   * Returns scan ID and initial status.
   */
  app.post<{
    Reply: {
      scanId?: number;
      status?: string;
      message?: string;
      error?: string;
      details?: string;
    };
  }>(
    "/api/admin/media/scan-tv",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userName = request.session.userName ?? request.session.email;
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const result = await scanMediaDirectory(userName, "tv");

        if (!result.success) {
          return reply.status(400).send({
            error: result.message,
          });
        }

        return reply.status(202).send({
          scanId: result.scanId,
          status: "Scan started",
          message: result.message,
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          error: "Failed to start scan",
          details: errorMsg,
        });
      }
    },
  );

  /**
   * GET /api/admin/media/scan/:scanId
   * Get the status of a specific scan.
   */
  app.get<{
    Params: { scanId: string };
    Reply: {
      id?: number;
      status?: string;
      scanType?: string;
      totalFiles?: number;
      processedFiles?: number;
      skippedFiles?: number;
      errorCount?: number;
      startTime?: string;
      endTime?: string | null;
      errors?: any[];
      error?: string;
      details?: string;
    };
  }>(
    "/api/admin/media/scan/:scanId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const scanId = parseInt(request.params.scanId, 10);

      if (isNaN(scanId)) {
        return reply.status(400).send({ error: "Invalid scanId" });
      }

      try {
        const scanRecord = getScanStatus(scanId);

        if (!scanRecord) {
          return reply.status(404).send({ error: "Scan not found" });
        }

        // Check authorization: only creator or admin can view
        const userName = request.session.userName ?? request.session.email;
        if (scanRecord.userName !== userName) {
          return reply.status(403).send({ error: "Forbidden" });
        }

        return reply.send({
          id: scanRecord.id,
          status: scanRecord.status,
          scanType: scanRecord.scanType,
          totalFiles: scanRecord.totalFiles,
          processedFiles: scanRecord.processedFiles,
          skippedFiles: scanRecord.skippedFiles,
          errorCount: scanRecord.errorCount,
          startTime: scanRecord.startTime,
          endTime: scanRecord.endTime,
          errors: scanRecord.errorLog ? JSON.parse(scanRecord.errorLog) : [],
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          error: "Failed to get scan status",
          details: errorMsg,
        });
      }
    },
  );

  /**
   * GET /api/admin/media/scan-status/:scanType
   * Get the latest scan status for a given type (movies or tv).
   * Returns the most recent scan record.
   */
  app.get<{
    Params: { scanType: string };
    Reply: {
      id?: number;
      status?: string;
      scanType?: string;
      totalFiles?: number;
      processedFiles?: number;
      skippedFiles?: number;
      errorCount?: number;
      startTime?: string;
      endTime?: string | null;
      errors?: any[];
      error?: string;
      details?: string;
    };
  }>(
    "/api/admin/media/scan-status/:scanType",
    { preHandler: requireAuth },
    async (request, reply) => {
      const scanType = request.params.scanType as "movies" | "tv";
      const userName = request.session.userName ?? request.session.email;

      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      if (scanType !== "movies" && scanType !== "tv") {
        return reply.status(400).send({
          error: 'Invalid scanType. Must be "movies" or "tv".',
        });
      }

      try {
        const latestScan = getLatestScanStatus(userName, scanType);

        if (!latestScan) {
          return reply.status(404).send({
            error: `No ${scanType} scan found for this user`,
          });
        }

        return reply.send({
          id: latestScan.id,
          status: latestScan.status,
          scanType: latestScan.scanType,
          totalFiles: latestScan.totalFiles,
          processedFiles: latestScan.processedFiles,
          skippedFiles: latestScan.skippedFiles,
          errorCount: latestScan.errorCount,
          startTime: latestScan.startTime,
          endTime: latestScan.endTime,
          errors: latestScan.errorLog ? JSON.parse(latestScan.errorLog) : [],
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(500).send({
          error: "Failed to get scan status",
          details: errorMsg,
        });
      }
    },
  );
}
