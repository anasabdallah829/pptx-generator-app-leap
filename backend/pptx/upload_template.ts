import { api, APIError } from "encore.dev/api";
import { templatesBucket } from "./storage";
import { pptxDB } from "./db";
import crypto from "crypto";
import busboy from "busboy";
import log from "encore.dev/log";

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

// Raw endpoint for uploading template files with unlimited body size
export const uploadTemplateRaw = api.raw(
  { 
    expose: true, 
    method: "POST", 
    path: "/upload-template-raw",
    bodyLimit: null // Remove size limit
  },
  async (req, res) => {
    try {
      const bb = busboy({ headers: req.headers, limits: { files: 1 } });
      let fileData: Buffer | null = null;
      let filename = '';

      bb.on('file', (_, file, info) => {
        filename = info.filename;
        const chunks: Buffer[] = [];
        
        file.on('data', (data) => {
          chunks.push(data);
        });
        
        file.on('close', () => {
          fileData = Buffer.concat(chunks);
          log.info(`Template file ${filename} received, size: ${fileData.length} bytes`);
        });
      });

      bb.on('close', async () => {
        try {
          if (!fileData || !filename) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing file data' }));
            return;
          }

          if (!filename.toLowerCase().endsWith('.pptx')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Only .pptx files are supported' }));
            return;
          }

          const hash = crypto.createHash('sha256').update(fileData).digest('hex');

          // Check if template already exists
          const existingTemplate = await pptxDB.queryRow`
            SELECT id, filename, hash FROM templates WHERE hash = ${hash}
          `;

          if (existingTemplate) {
            const placeholders = await extractPlaceholders(existingTemplate.id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              templateId: existingTemplate.id,
              hash: existingTemplate.hash,
              placeholders
            }));
            return;
          }

          // Upload to storage
          const filePath = `templates/${hash}/${filename}`;
          await templatesBucket.upload(filePath, fileData, {
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          });

          // Save to database
          const template = await pptxDB.queryRow`
            INSERT INTO templates (filename, file_path, hash)
            VALUES (${filename}, ${filePath}, ${hash})
            RETURNING id, filename, hash
          `;

          if (!template) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Failed to save template' }));
            return;
          }

          const placeholders = await extractPlaceholders(template.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            templateId: template.id,
            hash: template.hash,
            placeholders
          }));

        } catch (error) {
          log.error('Template processing error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process template'
          }));
        }
      });

      bb.on('error', (error) => {
        log.error('Busboy error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Upload error' }));
      });

      req.pipe(bb);

    } catch (error) {
      log.error('Upload template raw error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Server error' }));
    }
  }
);

// Uploads a PowerPoint template file and extracts placeholder information.
export const uploadTemplate = api<UploadTemplateRequest, UploadTemplateResponse>(
  { expose: true, method: "POST", path: "/upload-template", bodyLimit: 50 * 1024 * 1024 }, // 50MB limit for base64
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
