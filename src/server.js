require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { convertConfluenceToMarkdown } = require('./confluence');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get default configuration (without sensitive data)
app.get('/api/config', (req, res) => {
  res.json({
    cloud: {
      baseUrl: process.env.CONFLUENCE_CLOUD_BASE_URL || '',
      hasCredentials: !!(process.env.CONFLUENCE_CLOUD_EMAIL && process.env.CONFLUENCE_CLOUD_API_TOKEN)
    },
    datacenter: {
      baseUrl: process.env.CONFLUENCE_DC_BASE_URL || '',
      hasCredentials: !!(process.env.CONFLUENCE_DC_PAT || (process.env.CONFLUENCE_DC_USERNAME && process.env.CONFLUENCE_DC_PASSWORD))
    }
  });
});

// Convert Confluence page to Markdown
app.post('/api/convert', async (req, res) => {
  try {
    const {
      pageId,
      confluenceType, // 'cloud' or 'datacenter'
      baseUrl,
      // Cloud auth
      email,
      apiToken,
      // Data Center auth
      pat,
      username,
      password,
      // Options
      includeAttachments,
      includeMetadata
    } = req.body;

    if (!pageId) {
      return res.status(400).json({ error: 'Page ID is required' });
    }

    if (!confluenceType || !['cloud', 'datacenter'].includes(confluenceType)) {
      return res.status(400).json({ error: 'Invalid confluence type. Use "cloud" or "datacenter"' });
    }

    // Build configuration
    const config = {
      type: confluenceType,
      baseUrl: baseUrl || (confluenceType === 'cloud' 
        ? process.env.CONFLUENCE_CLOUD_BASE_URL 
        : process.env.CONFLUENCE_DC_BASE_URL),
      options: {
        includeAttachments: includeAttachments || false,
        includeMetadata: includeMetadata !== false // default true
      }
    };

    // Set auth based on type
    if (confluenceType === 'cloud') {
      config.email = email || process.env.CONFLUENCE_CLOUD_EMAIL;
      config.apiToken = apiToken || process.env.CONFLUENCE_CLOUD_API_TOKEN;
      
      if (!config.baseUrl || !config.email || !config.apiToken) {
        return res.status(400).json({ 
          error: 'Cloud Confluence requires baseUrl, email, and apiToken' 
        });
      }
    } else {
      // Data Center - prefer PAT, fall back to basic auth
      config.pat = pat || process.env.CONFLUENCE_DC_PAT;
      config.username = username || process.env.CONFLUENCE_DC_USERNAME;
      config.password = password || process.env.CONFLUENCE_DC_PASSWORD;
      
      if (!config.baseUrl) {
        return res.status(400).json({ error: 'Data Center Confluence requires baseUrl' });
      }
      
      // Allow anonymous access for public Confluence instances
      // (no pat and no username/password is fine)
    }

    const result = await convertConfluenceToMarkdown(pageId, config);
    
    res.json(result);
  } catch (error) {
    console.error('Conversion error:', error);
    
    // Handle specific error types
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return res.status(401).json({ error: 'Authentication failed. Check your credentials.' });
      }
      if (status === 403) {
        return res.status(403).json({ error: 'Access denied. You may not have permission to view this page.' });
      }
      if (status === 404) {
        return res.status(404).json({ error: 'Page not found. Check the page ID.' });
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to convert page' 
    });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🍌 Confluence to Markdown converter running on http://localhost:${PORT}`);
});
