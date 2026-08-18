const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});
const PORT = 8080;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.url.startsWith('/admin')) {
    proxy.web(req, res, { target: 'http://127.0.0.1:5174' }, (err) => {
      console.error('Proxy error (admin):', err.message);
      res.writeHead(502);
      res.end('Bad Gateway: Admin frontend not available');
    });
  } else if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
    proxy.web(req, res, { target: 'http://127.0.0.1:3000' }, (err) => {
      console.error('Proxy error (backend):', err.message);
      res.writeHead(502);
      res.end('Bad Gateway: Backend not available');
    });
  } else {
    proxy.web(req, res, { target: 'http://127.0.0.1:5173' }, (err) => {
      console.error('Proxy error (user):', err.message);
      res.writeHead(502);
      res.end('Bad Gateway: User frontend not available');
    });
  }
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io')) {
    proxy.ws(req, socket, head, { target: 'http://127.0.0.1:3000' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway running on http://0.0.0.0:${PORT}`);
  console.log(`  /admin/* -> http://127.0.0.1:5174`);
  console.log(`  /api/* -> http://127.0.0.1:3000`);
  console.log(`  /* -> http://127.0.0.1:5173`);
});
