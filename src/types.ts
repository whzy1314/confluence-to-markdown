export interface ConfluenceCredentials {
  baseUrl: string;
  username: string;
  /** API token for Cloud, or password for Data Center/Server */
  apiToken: string;
}

export type ConfluenceType = "cloud" | "datacenter";

export interface ConfluenceConfig {
  credentials: ConfluenceCredentials;
  type: ConfluenceType;
}

export interface ConfluencePage {
  id: string;
  title: string;
  body: string;
  spaceKey: string;
  version: number;
  ancestors: { id: string; title: string }[];
  children: { id: string; title: string }[];
  labels: string[];
  url: string;
}

export interface ConversionResult {
  markdown: string;
  title: string;
  pageId: string;
  warnings: string[];
}

export interface ConvertOptions {
  /** Include page metadata as YAML front matter */
  frontMatter?: boolean;
  /** Include child page links at the bottom */
  includeChildren?: boolean;
  /** Convert Confluence-specific macros to markdown equivalents */
  convertMacros?: boolean;
}
