const axios = require('axios');
const TurndownService = require('turndown');

// Configure Turndown for better Confluence HTML conversion
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_'
});

// Custom rules for Confluence-specific elements
turndown.addRule('confluenceCodeBlock', {
  filter: (node) => {
    return node.nodeName === 'PRE' || 
           (node.nodeName === 'DIV' && node.className && node.className.includes('code'));
  },
  replacement: (content, node) => {
    // Try to detect language from class
    const classes = node.className || '';
    const langMatch = classes.match(/language-(\w+)|brush:\s*(\w+)/);
    const lang = langMatch ? (langMatch[1] || langMatch[2]) : '';
    
    // Clean up the content
    const code = node.textContent.trim();
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  }
});

turndown.addRule('confluenceTable', {
  filter: 'table',
  replacement: (content, node) => {
    const rows = node.querySelectorAll('tr');
    if (rows.length === 0) return content;
    
    let markdown = '\n';
    let headerProcessed = false;
    
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = [];
      
      cells.forEach(cell => {
        // Convert cell content, replace newlines with <br>
        let cellText = turndown.turndown(cell.innerHTML)
          .replace(/\n/g, ' ')
          .replace(/\|/g, '\\|')
          .trim();
        cellContents.push(cellText);
      });
      
      markdown += '| ' + cellContents.join(' | ') + ' |\n';
      
      // Add header separator after first row
      if (!headerProcessed) {
        markdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
        headerProcessed = true;
      }
    });
    
    return markdown + '\n';
  }
});

// Handle Confluence info/warning/note panels
turndown.addRule('confluencePanel', {
  filter: (node) => {
    return node.nodeName === 'DIV' && node.className && 
           (node.className.includes('panel') || 
            node.className.includes('info') ||
            node.className.includes('warning') ||
            node.className.includes('note'));
  },
  replacement: (content, node) => {
    const classes = node.className || '';
    let prefix = '> ';
    
    if (classes.includes('warning')) prefix = '> ⚠️ **Warning:** ';
    else if (classes.includes('info')) prefix = '> ℹ️ **Info:** ';
    else if (classes.includes('note')) prefix = '> 📝 **Note:** ';
    
    return '\n' + content.split('\n').map(line => prefix + line).join('\n') + '\n';
  }
});

// Handle Confluence status macros
turndown.addRule('confluenceStatus', {
  filter: (node) => {
    return node.nodeName === 'SPAN' && node.className && 
           node.className.includes('status');
  },
  replacement: (content, node) => {
    return `\`${content.trim()}\``;
  }
});

// Handle images with better alt text
turndown.addRule('images', {
  filter: 'img',
  replacement: (content, node) => {
    const alt = node.getAttribute('alt') || 'image';
    const src = node.getAttribute('src') || '';
    const title = node.getAttribute('title') || '';
    
    // Skip emoticons and small icons
    if (src.includes('emoticon') || src.includes('icon')) {
      return '';
    }
    
    return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
  }
});

/**
 * Fetch page from Confluence Cloud
 */
async function fetchCloudPage(pageId, config) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  
  // Cloud API v2 endpoint
  const url = `${config.baseUrl.replace(/\/$/, '')}/wiki/api/v2/pages/${pageId}`;
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    },
    params: {
      'body-format': 'storage' // Get the storage format (HTML-like)
    }
  });
  
  return {
    id: response.data.id,
    title: response.data.title,
    body: response.data.body?.storage?.value || '',
    version: response.data.version?.number,
    createdAt: response.data.createdAt,
    authorId: response.data.authorId,
    spaceId: response.data.spaceId,
    webUrl: `${config.baseUrl}/wiki/spaces/${response.data.spaceId}/pages/${pageId}`
  };
}

/**
 * Fetch page from Confluence Data Center
 */
async function fetchDataCenterPage(pageId, config) {
  const headers = {
    'Accept': 'application/json'
  };
  
  // Use PAT if available, otherwise basic auth
  if (config.pat) {
    headers['Authorization'] = `Bearer ${config.pat}`;
  } else {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  
  // Data Center REST API endpoint
  const url = `${config.baseUrl.replace(/\/$/, '')}/rest/api/content/${pageId}`;
  
  const response = await axios.get(url, {
    headers,
    params: {
      expand: 'body.storage,version,space,ancestors'
    }
  });
  
  const data = response.data;
  
  return {
    id: data.id,
    title: data.title,
    body: data.body?.storage?.value || '',
    version: data.version?.number,
    createdAt: data.version?.when,
    authorName: data.version?.by?.displayName,
    spaceName: data.space?.name,
    spaceKey: data.space?.key,
    webUrl: `${config.baseUrl}${data._links?.webui || `/display/${data.space?.key}/${encodeURIComponent(data.title)}`}`
  };
}

/**
 * Convert Confluence page to Markdown
 */
async function convertConfluenceToMarkdown(pageId, config) {
  // Fetch page based on confluence type
  const page = config.type === 'cloud' 
    ? await fetchCloudPage(pageId, config)
    : await fetchDataCenterPage(pageId, config);
  
  // Convert HTML body to Markdown
  let markdown = turndown.turndown(page.body);
  
  // Clean up excessive whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
  
  // Add metadata header if requested
  if (config.options.includeMetadata) {
    const metadata = [
      '---',
      `title: "${page.title.replace(/"/g, '\\"')}"`,
      `confluence_id: ${page.id}`,
      `source: ${config.type}`,
    ];
    
    if (page.spaceKey) metadata.push(`space: ${page.spaceKey}`);
    if (page.spaceName) metadata.push(`space_name: "${page.spaceName}"`);
    if (page.version) metadata.push(`version: ${page.version}`);
    if (page.createdAt) metadata.push(`last_modified: ${page.createdAt}`);
    if (page.authorName) metadata.push(`author: "${page.authorName}"`);
    if (page.webUrl) metadata.push(`url: ${page.webUrl}`);
    
    metadata.push('---', '');
    
    markdown = metadata.join('\n') + '\n# ' + page.title + '\n\n' + markdown;
  } else {
    markdown = '# ' + page.title + '\n\n' + markdown;
  }
  
  return {
    title: page.title,
    pageId: page.id,
    markdown,
    webUrl: page.webUrl,
    filename: sanitizeFilename(page.title) + '.md'
  };
}

/**
 * Sanitize title for use as filename
 */
function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .substring(0, 100);
}

module.exports = {
  convertConfluenceToMarkdown
};
