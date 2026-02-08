import axios from "axios";
import { ConfluenceClient } from "../src/confluence/client";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

function mockAxiosInstance() {
  const instance = {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { baseURL: "" },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  mockedAxios.create.mockReturnValue(instance as unknown as ReturnType<typeof axios.create>);
  return instance;
}

function makePageResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "12345",
      title: "Test Page",
      body: { storage: { value: "<p>Hello</p>" } },
      space: { key: "TEST" },
      version: { number: 3 },
      ancestors: [{ id: "111", title: "Parent" }],
      children: { page: { results: [{ id: "222", title: "Child" }] } },
      metadata: { labels: { results: [{ name: "docs" }] } },
      _links: { webui: "/spaces/TEST/pages/12345/Test+Page" },
      ...overrides,
    },
  };
}

describe("ConfluenceClient", () => {
  describe("constructor", () => {
    it("uses /wiki/rest/api base for cloud type", () => {
      mockAxiosInstance();
      ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://test.atlassian.net/wiki/rest/api",
        })
      );
    });

    it("uses /rest/api base for datacenter type", () => {
      mockAxiosInstance();
      ConfluenceClient.fromCredentials(
        { baseUrl: "https://confluence.internal.com", username: "u", apiToken: "t" },
        "datacenter"
      );
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://confluence.internal.com/rest/api",
        })
      );
    });

    it("strips trailing slashes from base URL", () => {
      mockAxiosInstance();
      ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net///", username: "u", apiToken: "t" },
        "cloud"
      );
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://test.atlassian.net/wiki/rest/api",
        })
      );
    });

    it("sets auth credentials", () => {
      mockAxiosInstance();
      ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "admin", apiToken: "secret" },
        "cloud"
      );
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { username: "admin", password: "secret" },
        })
      );
    });
  });

  describe("getPage", () => {
    it("fetches and maps a page correctly", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      instance.get.mockResolvedValue(makePageResponse());

      const page = await client.getPage("12345");

      expect(instance.get).toHaveBeenCalledWith("/content/12345", {
        params: expect.objectContaining({ expand: expect.any(String) }),
      });
      expect(page.id).toBe("12345");
      expect(page.title).toBe("Test Page");
      expect(page.body).toBe("<p>Hello</p>");
      expect(page.spaceKey).toBe("TEST");
      expect(page.version).toBe(3);
      expect(page.ancestors).toEqual([{ id: "111", title: "Parent" }]);
      expect(page.children).toEqual([{ id: "222", title: "Child" }]);
      expect(page.labels).toEqual(["docs"]);
      expect(page.url).toContain("/spaces/TEST/pages/12345/Test+Page");
    });

    it("throws descriptive error on 404", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      const error = Object.assign(new Error("Not Found"), {
        response: { status: 404, data: { message: "Not Found" } },
        isAxiosError: true,
      });
      // Make it an AxiosError
      Object.setPrototypeOf(error, axios.AxiosError.prototype);

      instance.get.mockRejectedValue(error);

      await expect(client.getPage("99999")).rejects.toThrow(
        "Page 99999 not found"
      );
    });

    it("throws descriptive error on 401", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      const error = Object.assign(new Error("Unauthorized"), {
        response: { status: 401, data: { message: "Unauthorized" } },
        isAxiosError: true,
      });
      Object.setPrototypeOf(error, axios.AxiosError.prototype);

      instance.get.mockRejectedValue(error);

      await expect(client.getPage("12345")).rejects.toThrow(
        "Authentication failed"
      );
    });
  });

  describe("getPageByTitle", () => {
    it("returns null when no results found", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      instance.get.mockResolvedValue({ data: { results: [] } });

      const result = await client.getPageByTitle("TEST", "Nonexistent");
      expect(result).toBeNull();
    });

    it("returns the first matching page", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      instance.get.mockResolvedValue({
        data: {
          results: [makePageResponse().data],
        },
      });

      const page = await client.getPageByTitle("TEST", "Test Page");
      expect(page).not.toBeNull();
      expect(page!.title).toBe("Test Page");
    });
  });

  describe("testConnection", () => {
    it("returns true on successful connection", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      instance.get.mockResolvedValue({ data: { results: [] } });

      const result = await client.testConnection();
      expect(result).toBe(true);
    });

    it("returns false on failed connection", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      instance.get.mockRejectedValue(new Error("Network error"));

      const result = await client.testConnection();
      expect(result).toBe(false);
    });
  });

  describe("getChildPages", () => {
    it("returns child pages list", async () => {
      const instance = mockAxiosInstance();
      const client = ConfluenceClient.fromCredentials(
        { baseUrl: "https://test.atlassian.net", username: "u", apiToken: "t" },
        "cloud"
      );

      instance.get.mockResolvedValue({
        data: {
          results: [
            { id: "1", title: "Child 1" },
            { id: "2", title: "Child 2" },
          ],
        },
      });

      const children = await client.getChildPages("12345");
      expect(children).toEqual([
        { id: "1", title: "Child 1" },
        { id: "2", title: "Child 2" },
      ]);
    });
  });
});
