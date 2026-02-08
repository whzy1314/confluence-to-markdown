import { Router, Request, Response } from "express";
import { ConfluenceClient } from "../confluence/client";
import { ConfluenceConverter } from "../converter/converter";
import { ConfluenceType, ConvertOptions } from "../types";

export const apiRouter = Router();

interface ConvertBody {
  pageId: string;
  baseUrl: string;
  username: string;
  apiToken: string;
  type?: ConfluenceType;
  options?: ConvertOptions;
}

apiRouter.post("/convert", async (req: Request, res: Response) => {
  try {
    const body = req.body as ConvertBody;

    if (!body.pageId || !body.baseUrl || !body.username || !body.apiToken) {
      res.status(400).json({
        error: "Missing required fields: pageId, baseUrl, username, apiToken",
      });
      return;
    }

    const client = ConfluenceClient.fromCredentials(
      {
        baseUrl: body.baseUrl,
        username: body.username,
        apiToken: body.apiToken,
      },
      body.type || "cloud"
    );

    const converter = new ConfluenceConverter(body.options);

    const page = await client.getPage(body.pageId);
    const result = converter.convert(page);

    res.json({
      success: true,
      title: result.title,
      pageId: result.pageId,
      markdown: result.markdown,
      warnings: result.warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

apiRouter.post("/test-connection", async (req: Request, res: Response) => {
  try {
    const body = req.body as Omit<ConvertBody, "pageId" | "options">;

    if (!body.baseUrl || !body.username || !body.apiToken) {
      res.status(400).json({
        error: "Missing required fields: baseUrl, username, apiToken",
      });
      return;
    }

    const client = ConfluenceClient.fromCredentials(
      {
        baseUrl: body.baseUrl,
        username: body.username,
        apiToken: body.apiToken,
      },
      body.type || "cloud"
    );

    const ok = await client.testConnection();
    res.json({ success: ok });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Default credentials endpoint - returns env-configured credentials if set
apiRouter.get("/defaults", (_req: Request, res: Response) => {
  const defaults = {
    baseUrl: process.env.CONFLUENCE_BASE_URL || "",
    username: process.env.CONFLUENCE_USERNAME || "",
    hasToken: !!process.env.CONFLUENCE_API_TOKEN,
    type: process.env.CONFLUENCE_TYPE || "cloud",
  };
  res.json(defaults);
});
