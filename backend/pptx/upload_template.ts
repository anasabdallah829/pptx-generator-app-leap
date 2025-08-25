import { api, APIError } from "encore.dev/api";
import { templatesBucket } from "./storage";
import { pptxDB } from "./db";
import crypto from "crypto";

interface UploadTemplateRequest {
  filename: string;
  fileData: string; // base64 encoded
}

interface UploadTemplateResponse {
  success: boolean;
  templateId?: number;
  hash?: string;
  placeholders?: PlaceholderInfo[];
  error?: string;
}

interface PlaceholderInfo {
  slideIndex: number;
  placeholderType: string;
  name?: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

// Uploads a PowerPoint template file and extracts placeholder information.
export const uploadTemplate = api<UploadTemplateRequest, UploadTemplateResponse>(
  { expose: true, method: "POST", path: "/upload-template" },
  async (req) => {
    try {
      if (!req.filename.toLowerCase().endsWith('.pptx')) {
        throw APIError.invalidArgument("Only .pptx files are supported");
      }

      const fileBuffer = Buffer.from(req.fileData, 'base64');
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check if template already exists
      const existingTemplate = await pptxDB.queryRow`
        SELECT id, filename, hash FROM templates WHERE hash = ${hash}
      `;

      if (existingTemplate) {
        const placeholders = await extractPlaceholders(existingTemplate.id);
        return {
          success: true,
          templateId: existingTemplate.id,
          hash: existingTemplate.hash,
          placeholders
        };
      }

      // Upload to storage
      const filePath = `templates/${hash}/${req.filename}`;
      await templatesBucket.upload(filePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

      // Save to database
      const template = await pptxDB.queryRow`
        INSERT INTO templates (filename, file_path, hash)
        VALUES (${req.filename}, ${filePath}, ${hash})
        RETURNING id, filename, hash
      `;

      if (!template) {
        throw APIError.internal("Failed to save template");
      }

      const placeholders = await extractPlaceholders(template.id);

      return {
        success: true,
        templateId: template.id,
        hash: template.hash,
        placeholders
      };
    } catch (error) {
      console.error("Upload template error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to upload template"
      };
    }
  }
);

async function extractPlaceholders(templateId: number): Promise<PlaceholderInfo[]> {
  // This is a simplified placeholder extraction
  // In a real implementation, you would parse the PPTX file to extract actual placeholders
  return [
    {
      slideIndex: 0,
      placeholderType: "title",
      name: "Title Placeholder",
      left: 100,
      top: 50,
      width: 800,
      height: 100
    },
    {
      slideIndex: 0,
      placeholderType: "content",
      name: "Content Placeholder",
      left: 100,
      top: 200,
      width: 800,
      height: 400
    }
  ];
}
