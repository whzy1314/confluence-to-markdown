import TurndownService from "turndown";
import { ConfluencePage, ConversionResult, ConvertOptions } from "../types";

/** Turndown passes DOM-like nodes; this covers the methods we use. */
interface TurndownNode {
  nodeName: string;
  textContent: string | null;
  classList?: { contains(className: string): boolean };
  getAttribute?(name: string): string | null;
}

export class ConfluenceConverter {
  private turndown: TurndownService;
  private options: Required<ConvertOptions>;

  constructor(options: ConvertOptions = {}) {
    this.options = {
      frontMatter: options.frontMatter ?? true,
      includeChildren: options.includeChildren ?? true,
      convertMacros: options.convertMacros ?? true,
    };

    this.turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
    });

    this.addConfluenceRules();
  }

  convert(page: ConfluencePage): ConversionResult {
    const warnings: string[] = [];
    let html = page.body;

    if (this.options.convertMacros) {
      const macroResult = this.preprocessMacros(html);
      html = macroResult.html;
      warnings.push(...macroResult.warnings);
    }

    // Clean up Confluence-specific HTML quirks
    html = this.cleanHtml(html);

    let markdown = this.turndown.turndown(html);

    // Post-process the markdown
    markdown = this.postProcess(markdown);

    // Add front matter
    if (this.options.frontMatter) {
      markdown = this.addFrontMatter(page) + markdown;
    }

    // Add child pages section
    if (this.options.includeChildren && page.children.length > 0) {
      markdown += this.buildChildrenSection(page.children);
    }

    return {
      markdown: markdown.trim() + "\n",
      title: page.title,
      pageId: page.id,
      warnings,
    };
  }

  private addConfluenceRules(): void {
    // Confluence status macros -> badges
    this.turndown.addRule("confluenceStatus", {
      filter: (node) => {
        return (
          node.nodeName === "SPAN" &&
          node.classList?.contains("status-macro") === true
        );
      },
      replacement: (_content, node) => {
        return `\`${node.textContent?.trim() || "STATUS"}\``;
      },
    });

    // Confluence user mentions
    this.turndown.addRule("confluenceUserMention", {
      filter: (node) => {
        return (
          node.nodeName === "A" &&
          (node.classList?.contains("confluence-userlink") === true ||
            node.getAttribute("data-username") !== null)
        );
      },
      replacement: (_content, node) => {
        return `@${node.textContent?.trim() || "user"}`;
      },
    });

    // Confluence emoticons
    this.turndown.addRule("confluenceEmoticon", {
      filter: (node) => {
        return (
          node.nodeName === "IMG" &&
          node.classList?.contains("emoticon") === true
        );
      },
      replacement: (_content, node) => {
        const el = node as unknown as TurndownNode;
        const alt = el.getAttribute?.("alt") || el.getAttribute?.("data-emoji-fallback");
        return alt || "";
      },
    });

    // Confluence page links
    this.turndown.addRule("confluencePageLink", {
      filter: (node) => {
        return (
          node.nodeName === "A" &&
          node.getAttribute("data-linked-resource-type") === "page"
        );
      },
      replacement: (content) => {
        return `[${content}]`;
      },
    });

    // Confluence images with thumbnails
    this.turndown.addRule("confluenceImage", {
      filter: (node) => {
        return (
          node.nodeName === "IMG" &&
          node.getAttribute("data-linked-resource-type") === "attachment"
        );
      },
      replacement: (_content, node) => {
        const el = node as unknown as TurndownNode;
        const alt = el.getAttribute?.("alt") || "image";
        const src =
          el.getAttribute?.("src") || el.getAttribute?.("data-image-src") || "";
        return `![${alt}](${src})`;
      },
    });

    // Table of contents macro -> just a note
    this.turndown.addRule("confluenceToc", {
      filter: (node) => {
        return (
          node.nodeName === "DIV" &&
          node.classList?.contains("toc-macro") === true
        );
      },
      replacement: () => {
        return "<!-- Table of Contents was here -->\n\n";
      },
    });
  }

  private preprocessMacros(html: string): {
    html: string;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Code blocks: <ac:structured-macro ac:name="code">
    html = html.replace(
      /<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/gi,
      (_match, code) => {
        // Try to extract language
        const langMatch = _match.match(
          /<ac:parameter ac:name="language">([\s\S]*?)<\/ac:parameter>/i
        );
        const lang = langMatch ? langMatch[1].trim() : "";
        return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
      }
    );

    // Noformat blocks
    html = html.replace(
      /<ac:structured-macro[^>]*ac:name="noformat"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/gi,
      (_match, code) => {
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
    );

    // Info, note, warning, tip panels
    const panelTypes = ["info", "note", "warning", "tip"];
    for (const panelType of panelTypes) {
      const regex = new RegExp(
        `<ac:structured-macro[^>]*ac:name="${panelType}"[^>]*>([\\s\\S]*?)<\\/ac:structured-macro>`,
        "gi"
      );
      html = html.replace(regex, (_match, content) => {
        // Extract body content
        const bodyMatch = content.match(
          /<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/i
        );
        const body = bodyMatch ? bodyMatch[1] : content;
        const emoji =
          panelType === "info"
            ? "i"
            : panelType === "note"
              ? "!"
              : panelType === "warning"
                ? "!!"
                : "*";
        return `<blockquote><p><strong>[${emoji}] ${panelType.toUpperCase()}:</strong></p>${body}</blockquote>`;
      });
    }

    // Expand macros
    html = html.replace(
      /<ac:structured-macro[^>]*ac:name="expand"[^>]*>([\s\S]*?)<\/ac:structured-macro>/gi,
      (_match, content) => {
        const titleMatch = content.match(
          /<ac:parameter ac:name="title">([\s\S]*?)<\/ac:parameter>/i
        );
        const bodyMatch = content.match(
          /<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/i
        );
        const title = titleMatch ? titleMatch[1].trim() : "Details";
        const body = bodyMatch ? bodyMatch[1] : "";
        return `<details><summary>${title}</summary>${body}</details>`;
      }
    );

    // Jira issue links
    html = html.replace(
      /<ac:structured-macro[^>]*ac:name="jira"[^>]*>[\s\S]*?<ac:parameter ac:name="key">([\s\S]*?)<\/ac:parameter>[\s\S]*?<\/ac:structured-macro>/gi,
      (_match, key) => {
        return `<code>${key.trim()}</code>`;
      }
    );

    // Anchor macros
    html = html.replace(
      /<ac:structured-macro[^>]*ac:name="anchor"[^>]*>[\s\S]*?<ac:parameter ac:name="">([\s\S]*?)<\/ac:parameter>[\s\S]*?<\/ac:structured-macro>/gi,
      (_match, name) => {
        return `<a id="${name.trim()}"></a>`;
      }
    );

    // Remove remaining unknown macros but warn about them
    html = html.replace(
      /<ac:structured-macro[^>]*ac:name="([^"]*)"[^>]*>[\s\S]*?<\/ac:structured-macro>/gi,
      (_match, name) => {
        warnings.push(`Unsupported macro removed: ${name}`);
        return `<!-- Unsupported Confluence macro: ${name} -->`;
      }
    );

    // Clean up remaining ac: tags
    html = html.replace(/<ac:[^>]*\/>/gi, "");
    html = html.replace(/<\/?ac:[^>]*>/gi, "");

    // Clean up ri: tags (resource identifiers)
    html = html.replace(/<ri:[^>]*\/>/gi, "");
    html = html.replace(/<\/?ri:[^>]*>/gi, "");

    return { html, warnings };
  }

  private cleanHtml(html: string): string {
    // Remove Confluence storage format wrapper divs
    html = html.replace(
      /<div class="confluence-information-macro[^"]*"[^>]*>/gi,
      "<div>"
    );

    // Normalize whitespace in table cells
    html = html.replace(/<td[^>]*>\s*<br\s*\/?>\s*/gi, "<td>");
    html = html.replace(/\s*<br\s*\/?>\s*<\/td>/gi, "</td>");

    // Remove empty paragraphs
    html = html.replace(/<p>\s*<\/p>/gi, "");
    html = html.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "");

    return html;
  }

  private postProcess(markdown: string): string {
    // Remove trailing whitespace from lines
    markdown = markdown.replace(/[ \t]+$/gm, "");

    // Collapse lines that are only whitespace into empty lines
    markdown = markdown.replace(/\n[ \t]*\n/g, "\n\n");

    // Collapse 3+ consecutive newlines into 2
    markdown = markdown.replace(/\n{3,}/g, "\n\n");

    // Ensure headers have blank lines around them
    markdown = markdown.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");
    markdown = markdown.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, "$1\n\n$2");

    return markdown;
  }

  private addFrontMatter(page: ConfluencePage): string {
    const lines = [
      "---",
      `title: "${page.title.replace(/"/g, '\\"')}"`,
      `page_id: "${page.id}"`,
      `space: "${page.spaceKey}"`,
    ];

    if (page.labels.length > 0) {
      lines.push(`labels: [${page.labels.map((l) => `"${l}"`).join(", ")}]`);
    }

    lines.push(`source: "${page.url}"`);
    lines.push("---", "", "");

    return lines.join("\n");
  }

  private buildChildrenSection(
    children: { id: string; title: string }[]
  ): string {
    const lines = ["\n\n---\n\n## Child Pages\n"];
    for (const child of children) {
      lines.push(`- ${child.title} (ID: ${child.id})`);
    }
    lines.push("");
    return lines.join("\n");
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
