import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import type { SessionData } from "./types";

interface GetSessionRequest {
  sessionId: string;
}

interface GetSessionResponse {
  success: boolean;
  session?: SessionData;
  error?: string;
}

// Retrieves session data by session ID.
export const getSession = api<GetSessionRequest, GetSessionResponse>(
  { expose: true, method: "GET", path: "/sessions/:sessionId" },
  async (req) => {
    try {
      const session = await pptxDB.queryRow`
        SELECT folders_data, settings_data FROM sessions WHERE session_id = ${req.sessionId}
      `;

      if (!session) {
        throw APIError.notFound("Session not found");
      }

      return {
        success: true,
        session: {
          folders: session.folders_data || [],
          settings: session.settings_data || getDefaultSettings()
        }
      };
    } catch (error) {
      console.error("Get session error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to get session"
      };
    }
  }
);

function getDefaultSettings() {
  return {
    layout: {
      grid: true,
      rows: 2,
      columns: 3,
      autoFit: true,
      preserveAspect: true
    },
    usePlaceholders: true,
    insertFolderNameAsTitle: true,
    language: "en"
  };
}
