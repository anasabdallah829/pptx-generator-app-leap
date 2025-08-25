import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import { imagesBucket, outputBucket } from "./storage";

interface DeleteSessionRequest {
  sessionId: string;
}

interface DeleteSessionResponse {
  success: boolean;
  error?: string;
}

// Deletes a session and all associated files.
export const deleteSession = api<DeleteSessionRequest, DeleteSessionResponse>(
  { expose: true, method: "DELETE", path: "/sessions/:sessionId" },
  async (req) => {
    try {
      const session = await pptxDB.queryRow`
        SELECT id FROM sessions WHERE session_id = ${req.sessionId}
      `;

      if (!session) {
        throw APIError.notFound("Session not found");
      }

      // Delete images from storage
      try {
        const imagesList = imagesBucket.list({ prefix: `images/${req.sessionId}/` });
        for await (const image of imagesList) {
          await imagesBucket.remove(image.name);
        }
      } catch (error) {
        console.warn("Failed to delete some images:", error);
      }

      // Delete output files from storage
      try {
        const outputList = outputBucket.list({ prefix: `output/${req.sessionId}/` });
        for await (const output of outputList) {
          await outputBucket.remove(output.name);
        }
      } catch (error) {
        console.warn("Failed to delete some output files:", error);
      }

      // Delete generated files records
      await pptxDB.exec`
        DELETE FROM generated_files WHERE session_id = ${req.sessionId}
      `;

      // Delete session
      await pptxDB.exec`
        DELETE FROM sessions WHERE session_id = ${req.sessionId}
      `;

      return { success: true };
    } catch (error) {
      console.error("Delete session error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to delete session"
      };
    }
  }
);
