const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const SRC = path.join(__dirname, 'src');

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy endpoint for Anthropic API
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name, apiKey } = JSON.parse(body);

        const prompt = `You are a clinical reference assistant for physiotherapists. Generate structured clinical notes for the pathology: "${name}".

Return ONLY valid JSON in this exact structure (no markdown, no extra text, no code fences):
{
  "category": "MSK",
  "subcategory": "<specific body region or system, e.g. Knee, Cardiac, CNS>",
  "sections": [
    { "title": "Overview & Definition", "content": "<text>", "redFlag": false, "open": true },
    { "title": "Clinical Presentation", "content": "<text>", "redFlag": false, "open": true },
    { "title": "Assessment & Outcome Measures", "content": "<text>", "redFlag": false, "open": false },
    { "title": "⚠ Red Flags", "content": "<text>", "redFlag": true, "open": true },
    { "title": "Physiotherapy Management", "content": "<text>", "redFlag": false, "open": true },
    { "title": "Evidence Base & Guidelines", "content": "<text>", "redFlag": false, "open": false }
  ]
}

category must be one of: MSK, CVR, NEURO. Use **bold**, *italic*, or lines starting with - for bullets. Be concise but clinically thorough.`;

        const payload = JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        });

        const apiReq = https.request({
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, apiRes => {
          let data = '';
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        apiReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        });

        apiReq.write(payload);
        apiReq.end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Bad request' } }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(SRC, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      res.end(data);
    }
  });

}).listen(PORT, () => {
  console.log(`PhysioRef running at http://192.168.1.192:${PORT}`);
});
