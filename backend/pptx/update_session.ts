import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import type { SessionData } from "./types";

interface UpdateSessionRequest {
  sessionId: string;
  sessionData: SessionData;
}

interface UpdateSessionResponse {
  success: boolean;
  error?: string;
}

// Updates session data with folders and settings.
export const updateSession = api<UpdateSessionRequest, UpdateSessionResponse>(
  { expose: true, method: "POST", path: "/update-session" },
  async (req) => {
    try {
      const existingSession = await pptxDB.queryRow`
        SELECT id FROM sessions WHERE session_id = ${req.sessionId}
      `;

      if (existingSession) {
        await pptxDB.exec`
          UPDATE sessions 
          SET folders_data = ${JSON.stringify(req.sessionData.folders)}, 
              settings_data = ${JSON.stringify(req.sessionData.settings)},
              updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ${req.sessionId}
        `;
      } else {
        await pptxDB.exec`
          INSERT INTO sessions (session_id, folders_data, settings_data)
          VALUES (${req.sessionId}, ${JSON.stringify(req.sessionData.folders)}, ${JSON.stringify(req.sessionData.settings)})
        `;
      }

      return { success: true };
    } catch (error) {
      console.error("Update session error:", error);
      return {
        success: false,
        error: "Failed to update session"
      };
    }
  }
);
