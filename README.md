# Confluence to Markdown Converter

A web application to convert Confluence pages to clean Markdown. Supports both **Confluence Cloud** and **Data Center/Server** deployments.

## Features

- 📝 Convert any Confluence page to Markdown using its page ID
- ☁️ Support for **Confluence Cloud** (Atlassian Cloud)
- 🏢 Support for **Confluence Data Center/Server** (self-hosted)
- 🔐 Configurable default credentials via environment variables
- 👤 Option for users to provide their own credentials per request
- 📄 Optional YAML frontmatter with page metadata
- 💾 Copy to clipboard or download as `.md` file
- 🎨 Clean, responsive UI

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yzeng1314/confluence-to-markdown.git
cd confluence-to-markdown
npm install
```

### 2. Configure (Optional)

Copy the example environment file and add your default credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Confluence credentials. Users can also provide their own credentials via the UI.

### 3. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| **Cloud Confluence** | |
| `CONFLUENCE_CLOUD_BASE_URL` | Your Atlassian Cloud URL (e.g., `https://company.atlassian.net`) |
| `CONFLUENCE_CLOUD_EMAIL` | Your Atlassian account email |
| `CONFLUENCE_CLOUD_API_TOKEN` | API token from [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| **Data Center Confluence** | |
| `CONFLUENCE_DC_BASE_URL` | Your Data Center URL (e.g., `https://confluence.company.com`) |
| `CONFLUENCE_DC_PAT` | Personal Access Token (recommended) |
| `CONFLUENCE_DC_USERNAME` | Username (if not using PAT) |
| `CONFLUENCE_DC_PASSWORD` | Password (if not using PAT) |

## Finding the Page ID

### Confluence Cloud
The page ID is in the URL: `https://company.atlassian.net/wiki/spaces/SPACE/pages/123456789/Page+Title`
- Page ID: `123456789`

### Data Center/Server
1. Open the page
2. Click **...** menu → **Page Information** or **Page History**
3. Look for the ID in the URL: `/pages/viewpage.action?pageId=123456`
- Page ID: `123456`

## API Usage

### POST /api/convert

Convert a Confluence page to Markdown.

**Request:**
```json
{
  "pageId": "123456789",
  "confluenceType": "cloud",
  "baseUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "apiToken": "your-api-token",
  "includeMetadata": true
}
```

For Data Center:
```json
{
  "pageId": "123456",
  "confluenceType": "datacenter",
  "baseUrl": "https://confluence.company.com",
  "pat": "your-personal-access-token",
  "includeMetadata": true
}
```

**Response:**
```json
{
  "title": "Page Title",
  "pageId": "123456789",
  "markdown": "---\ntitle: \"Page Title\"\n...",
  "webUrl": "https://...",
  "filename": "page-title.md"
}
```

## Markdown Conversion

The converter handles common Confluence elements:

- ✅ Headings, paragraphs, lists
- ✅ Code blocks (with language detection)
- ✅ Tables
- ✅ Info/Warning/Note panels
- ✅ Links and images
- ✅ Bold, italic, underline
- ✅ Status macros

## Docker

### Build locally

```bash
docker build -t confluence-to-markdown .
docker run -p 3000:3000 confluence-to-markdown
```

### Use pre-built image

```bash
docker run -p 3000:3000 \
  -e CONFLUENCE_CLOUD_BASE_URL=https://company.atlassian.net \
  -e CONFLUENCE_CLOUD_EMAIL=you@company.com \
  -e CONFLUENCE_CLOUD_API_TOKEN=your-token \
  ghcr.io/yzeng1314/confluence-to-markdown:latest
```

## Kubernetes Deployment

### Quick Start

```bash
# Apply all manifests
kubectl apply -k k8s/

# Or apply individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml  # Edit with your credentials first
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml  # Edit hostname first
kubectl apply -f k8s/hpa.yaml
```

### Configuration

1. **Edit `k8s/secret.yaml`** with your Confluence credentials
2. **Edit `k8s/configmap.yaml`** with default Confluence URLs
3. **Edit `k8s/ingress.yaml`** with your domain name

### Manifests Included

| File | Description |
|------|-------------|
| `namespace.yaml` | Creates dedicated namespace |
| `configmap.yaml` | Non-sensitive configuration |
| `secret.yaml` | Confluence credentials (edit before applying) |
| `deployment.yaml` | Pod deployment with health checks |
| `service.yaml` | ClusterIP service |
| `ingress.yaml` | Ingress rule (edit hostname) |
| `hpa.yaml` | Horizontal Pod Autoscaler (2-10 replicas) |
| `kustomization.yaml` | Kustomize configuration |

## CI/CD

GitHub Actions automatically:
- Runs tests on every PR
- Builds and pushes Docker image to `ghcr.io` on merge to `main`
- Supports multi-arch builds (amd64, arm64)
- Tags with: `latest`, branch name, commit SHA, semver (for tags)

## Development

```bash
# Run with auto-reload
npm run dev
```

## License

MIT
