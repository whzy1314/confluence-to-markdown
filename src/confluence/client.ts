import axios, { AxiosInstance, AxiosError } from "axios";
import {
  ConfluenceConfig,
  ConfluenceCredentials,
  ConfluencePage,
  ConfluenceType,
} from "../types";

export class ConfluenceClient {
  private http: AxiosInstance;
  private type: ConfluenceType;
  private baseUrl: string;

  constructor(config: ConfluenceConfig) {
    this.type = config.type;
    this.baseUrl = config.credentials.baseUrl.replace(/\/+$/, "");

    const apiBase =
      this.type === "cloud"
        ? `${this.baseUrl}/wiki/rest/api`
        : `${this.baseUrl}/rest/api`;

    this.http = axios.create({
      baseURL: apiBase,
      auth: {
        username: config.credentials.username,
        password: config.credentials.apiToken,
      },
      headers: {
        Accept: "application/json",
      },
      timeout: 30000,
    });
  }

  static fromCredentials(
    credentials: ConfluenceCredentials,
    type: ConfluenceType = "cloud"
  ): ConfluenceClient {
    return new ConfluenceClient({ credentials, type });
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    const expand = [
      "body.storage",
      "version",
      "ancestors",
      "children.page",
      "metadata.labels",
      "space",
    ].join(",");

    try {
      const response = await this.http.get(`/content/${pageId}`, {
        params: { expand },
      });

      return this.mapResponse(response.data);
    } catch (error) {
      throw this.wrapError(error, pageId);
    }
  }

  async getPageByTitle(
    spaceKey: string,
    title: string
  ): Promise<ConfluencePage | null> {
    try {
      const response = await this.http.get("/content", {
        params: {
          spaceKey,
          title,
          expand: "body.storage,version,ancestors,children.page,metadata.labels,space",
        },
      });

      const results = response.data.results;
      if (!results || results.length === 0) {
        return null;
      }

      return this.mapResponse(results[0]);
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  async getChildPages(pageId: string): Promise<{ id: string; title: string }[]> {
    try {
      const response = await this.http.get(`/content/${pageId}/child/page`, {
        params: { limit: 250 },
      });

      return (response.data.results || []).map(
        (child: { id: string; title: string }) => ({
          id: child.id,
          title: child.title,
        })
      );
    } catch (error) {
      throw this.wrapError(error, pageId);
    }
  }

  async getPageTree(
    pageId: string,
    depth: number = 5
  ): Promise<ConfluencePage[]> {
    const pages: ConfluencePage[] = [];

    const collect = async (id: string, currentDepth: number) => {
      const page = await this.getPage(id);
      pages.push(page);

      if (currentDepth < depth) {
        for (const child of page.children) {
          await collect(child.id, currentDepth + 1);
        }
      }
    };

    await collect(pageId, 0);
    return pages;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.http.get("/space", { params: { limit: 1 } });
      return true;
    } catch {
      return false;
    }
  }

  private mapResponse(data: Record<string, unknown>): ConfluencePage {
    const body = data.body as Record<string, Record<string, string>> | undefined;
    const space = data.space as Record<string, string> | undefined;
    const version = data.version as Record<string, number> | undefined;
    const ancestors = data.ancestors as { id: string; title: string }[] | undefined;
    const children = data.children as
      | { page: { results: { id: string; title: string }[] } }
      | undefined;
    const metadata = data.metadata as
      | { labels: { results: { name: string }[] } }
      | undefined;
    const _links = data._links as Record<string, string> | undefined;

    return {
      id: data.id as string,
      title: data.title as string,
      body: body?.storage?.value || "",
      spaceKey: space?.key || "",
      version: version?.number || 1,
      ancestors: (ancestors || []).map((a) => ({ id: a.id, title: a.title })),
      children: (children?.page?.results || []).map((c) => ({
        id: c.id,
        title: c.title,
      })),
      labels: (metadata?.labels?.results || []).map((l) => l.name),
      url: _links?.webui
        ? `${this.baseUrl}${_links.webui}`
        : `${this.baseUrl}/pages/viewpage.action?pageId=${data.id}`,
    };
  }

  private wrapError(error: unknown, pageId?: string): Error {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const detail =
        (error.response?.data as Record<string, string>)?.message ||
        error.message;

      if (status === 401) {
        return new Error(
          `Authentication failed. Check your credentials. (${detail})`
        );
      }
      if (status === 403) {
        return new Error(
          `Access denied${pageId ? ` for page ${pageId}` : ""}. Check permissions. (${detail})`
        );
      }
      if (status === 404) {
        return new Error(
          pageId
            ? `Page ${pageId} not found. Verify the page ID exists.`
            : `Resource not found. (${detail})`
        );
      }

      return new Error(
        `Confluence API error (HTTP ${status}): ${detail}`
      );
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
