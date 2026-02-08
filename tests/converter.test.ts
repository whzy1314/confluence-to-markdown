import { ConfluenceConverter } from "../src/converter/converter";
import { ConfluencePage } from "../src/types";

function makePage(overrides: Partial<ConfluencePage> = {}): ConfluencePage {
  return {
    id: "12345",
    title: "Test Page",
    body: "<p>Hello world</p>",
    spaceKey: "TEST",
    version: 1,
    ancestors: [],
    children: [],
    labels: [],
    url: "https://example.atlassian.net/wiki/spaces/TEST/pages/12345",
    ...overrides,
  };
}

describe("ConfluenceConverter", () => {
  let converter: ConfluenceConverter;

  beforeEach(() => {
    converter = new ConfluenceConverter();
  });

  describe("basic conversion", () => {
    it("converts simple HTML paragraph to markdown", () => {
      const page = makePage({ body: "<p>Hello world</p>" });
      const result = converter.convert(page);
      expect(result.markdown).toContain("Hello world");
      expect(result.pageId).toBe("12345");
      expect(result.title).toBe("Test Page");
    });

    it("converts headings", () => {
      const page = makePage({
        body: "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("# Title");
      expect(result.markdown).toContain("## Subtitle");
      expect(result.markdown).toContain("### Section");
    });

    it("converts bold and italic", () => {
      const page = makePage({
        body: "<p><strong>bold</strong> and <em>italic</em></p>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("**bold**");
      expect(result.markdown).toContain("*italic*");
    });

    it("converts unordered lists", () => {
      const page = makePage({
        body: "<ul><li>One</li><li>Two</li><li>Three</li></ul>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toMatch(/-\s+One/);
      expect(result.markdown).toMatch(/-\s+Two/);
      expect(result.markdown).toMatch(/-\s+Three/);
    });

    it("converts ordered lists", () => {
      const page = makePage({
        body: "<ol><li>First</li><li>Second</li></ol>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toMatch(/1\.\s+First/);
      expect(result.markdown).toMatch(/2\.\s+Second/);
    });

    it("converts links", () => {
      const page = makePage({
        body: '<p><a href="https://example.com">Example</a></p>',
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("[Example](https://example.com)");
    });

    it("converts tables", () => {
      const page = makePage({
        body: "<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("Name");
      expect(result.markdown).toContain("Value");
      expect(result.markdown).toContain("A");
    });

    it("converts inline code", () => {
      const page = makePage({
        body: "<p>Use <code>npm install</code> to install</p>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("`npm install`");
    });

    it("converts code blocks", () => {
      const page = makePage({
        body: "<pre><code>const x = 1;\nconst y = 2;</code></pre>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("```");
      expect(result.markdown).toContain("const x = 1;");
    });
  });

  describe("front matter", () => {
    it("includes YAML front matter by default", () => {
      const page = makePage({
        labels: ["docs", "api"],
      });
      const result = converter.convert(page);
      expect(result.markdown).toMatch(/^---\n/);
      expect(result.markdown).toContain('title: "Test Page"');
      expect(result.markdown).toContain('page_id: "12345"');
      expect(result.markdown).toContain('space: "TEST"');
      expect(result.markdown).toContain('labels: ["docs", "api"]');
    });

    it("excludes front matter when disabled", () => {
      const noFmConverter = new ConfluenceConverter({ frontMatter: false });
      const page = makePage();
      const result = noFmConverter.convert(page);
      expect(result.markdown).not.toMatch(/^---\n/);
    });

    it("escapes quotes in title", () => {
      const page = makePage({ title: 'Page with "quotes"' });
      const result = converter.convert(page);
      expect(result.markdown).toContain('title: "Page with \\"quotes\\""');
    });
  });

  describe("child pages", () => {
    it("includes child page section by default", () => {
      const page = makePage({
        children: [
          { id: "111", title: "Child One" },
          { id: "222", title: "Child Two" },
        ],
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("## Child Pages");
      expect(result.markdown).toContain("Child One (ID: 111)");
      expect(result.markdown).toContain("Child Two (ID: 222)");
    });

    it("excludes child pages when disabled", () => {
      const noChildConverter = new ConfluenceConverter({ includeChildren: false });
      const page = makePage({
        children: [{ id: "111", title: "Child One" }],
      });
      const result = noChildConverter.convert(page);
      expect(result.markdown).not.toContain("## Child Pages");
    });

    it("does not add child section when there are no children", () => {
      const page = makePage({ children: [] });
      const result = converter.convert(page);
      expect(result.markdown).not.toContain("## Child Pages");
    });
  });

  describe("Confluence macro conversion", () => {
    it("converts code macros with language", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">javascript</ac:parameter><ac:plain-text-body><![CDATA[console.log("hello");]]></ac:plain-text-body></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("```");
      expect(result.markdown).toContain('console.log("hello");');
    });

    it("converts noformat macros", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="noformat"><ac:plain-text-body><![CDATA[plain text here]]></ac:plain-text-body></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("```");
      expect(result.markdown).toContain("plain text here");
    });

    it("converts info panels", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="info"><ac:rich-text-body><p>This is informational</p></ac:rich-text-body></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("INFO");
      expect(result.markdown).toContain("This is informational");
    });

    it("converts warning panels", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="warning"><ac:rich-text-body><p>Be careful!</p></ac:rich-text-body></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("WARNING");
      expect(result.markdown).toContain("Be careful!");
    });

    it("converts expand macros to details/summary", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Click me</ac:parameter><ac:rich-text-body><p>Hidden content</p></ac:rich-text-body></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      // The details/summary HTML gets converted - check for the text content
      expect(result.markdown).toContain("Click me");
      expect(result.markdown).toContain("Hidden content");
    });

    it("converts jira issue macros", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">PROJ-123</ac:parameter></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("PROJ-123");
    });

    it("warns about unsupported macros", () => {
      const page = makePage({
        body: `<ac:structured-macro ac:name="custom-unknown-macro"><ac:parameter ac:name="foo">bar</ac:parameter></ac:structured-macro>`,
      });
      const result = converter.convert(page);
      expect(result.warnings).toContain(
        "Unsupported macro removed: custom-unknown-macro"
      );
    });
  });

  describe("HTML cleanup", () => {
    it("removes empty paragraphs", () => {
      const page = makePage({
        body: "<p>Real content</p><p></p><p>   </p><p>More content</p>",
      });
      const result = converter.convert(page);
      expect(result.markdown).toContain("Real content");
      expect(result.markdown).toContain("More content");
      // Should not have excessive blank lines
      expect(result.markdown).not.toMatch(/\n{4,}/);
    });

    it("collapses excessive blank lines", () => {
      const page = makePage({
        body: "<p>A</p><br><br><br><br><br><p>B</p>",
      });
      const result = converter.convert(page);
      // Should not have more than 2 consecutive newlines
      expect(result.markdown).not.toMatch(/\n{4,}/);
    });
  });

  describe("result structure", () => {
    it("returns correct result shape", () => {
      const page = makePage();
      const result = converter.convert(page);
      expect(result).toHaveProperty("markdown");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("pageId");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("ends with a single newline", () => {
      const page = makePage({ body: "<p>Content</p>" });
      const result = converter.convert(page);
      expect(result.markdown).toMatch(/[^\n]\n$/);
    });
  });
});
