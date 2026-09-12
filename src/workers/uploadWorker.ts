import { uploadQueue } from "../queue/bullConfig.js";
import { processBulkUploadJobService } from "../services/admin.service.js";

export function startUploadWorker() {
  uploadQueue.process(async (job) => {
    const { jobId } = job.data as { jobId: string };
    await processBulkUploadJobService(jobId);
  });

  console.log("[uploadWorker] listening for bulk-upload jobs");
}
