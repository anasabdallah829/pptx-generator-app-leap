import { api } from "encore.dev/api";
import { pptxDB } from "./db";

interface Session {
  id: number;
  sessionId: string;
  templateId: number | null;
  foldersCount: number;
  imagesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ListSessionsResponse {
  success: boolean;
  sessions: Session[];
  error?: string;
}

// Lists all sessions with summary information.
export const listSessions = api<void, ListSessionsResponse>(
  { expose: true, method: "GET", path: "/sessions" },
  async () => {
    try {
      const sessions = await pptxDB.queryAll`
        SELECT 
          id,
          session_id as "sessionId",
          template_id as "templateId",
          COALESCE(jsonb_array_length(folders_data), 0) as "foldersCount",
          COALESCE((
            SELECT SUM(jsonb_array_length(folder_data->'images'))
            FROM jsonb_array_elements(folders_data) as folder_data
          ), 0) as "imagesCount",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM sessions
        ORDER BY updated_at DESC
      `;

      return {
        success: true,
        sessions
      };
    } catch (error) {
      console.error("List sessions error:", error);
      return {
        success: false,
        sessions: [],
        error: "Failed to list sessions"
      };
    }
  }
);
