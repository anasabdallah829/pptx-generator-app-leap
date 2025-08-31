import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import type { PlaceholderInfo, PlaceholderProperties } from "./types";

interface UpdatePlaceholderRequest {
  sessionId: string;
  placeholderId: string;
  slideIndex: number;
  properties: PlaceholderProperties;
  position?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

interface UpdatePlaceholderResponse {
  success: boolean;
  placeholder?: PlaceholderInfo;
  error?: string;
}

// Updates placeholder properties and position for a specific slide.
export const updatePlaceholder = api<UpdatePlaceholderRequest, UpdatePlaceholderResponse>(
  { expose: true, method: "POST", path: "/update-placeholder" },
  async (req) => {
    try {
      // Get current session data
      const session = await pptxDB.queryRow`
        SELECT placeholder_settings FROM sessions WHERE session_id = ${req.sessionId}
      `;

      if (!session) {
        throw APIError.notFound("Session not found");
      }

      let placeholderSettings = session.placeholder_settings || {};

      // Update placeholder settings
      const placeholderKey = `${req.slideIndex}-${req.placeholderId}`;
      placeholderSettings[placeholderKey] = {
        placeholderId: req.placeholderId,
        slideIndex: req.slideIndex,
        properties: req.properties,
        position: req.position,
        updatedAt: new Date().toISOString()
      };

      // Save updated settings
      await pptxDB.exec`
        UPDATE sessions 
        SET placeholder_settings = ${JSON.stringify(placeholderSettings)}, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ${req.sessionId}
      `;

      // Return updated placeholder info
      const updatedPlaceholder: PlaceholderInfo = {
        id: req.placeholderId,
        slideIndex: req.slideIndex,
        placeholderType: 'content', // Would be determined from template analysis
        name: 'Updated Placeholder',
        left: req.position?.left || 0,
        top: req.position?.top || 0,
        width: req.position?.width || 0,
        height: req.position?.height || 0,
        properties: req.properties
      };

      return {
        success: true,
        placeholder: updatedPlaceholder
      };
    } catch (error) {
      console.error("Update placeholder error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to update placeholder"
      };
    }
  }
);
