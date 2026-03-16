import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));

  app.post('/api/proxy', async (req, res) => {
    const { method, url, headers, body } = req.body;
    
    const startTime = Date.now();
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: headers || {},
      };

      if (method !== 'GET' && method !== 'HEAD' && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const endTime = Date.now();
      
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let setCookies: string[] = [];
      if (typeof response.headers.getSetCookie === 'function') {
        setCookies = response.headers.getSetCookie();
      } else {
        const raw = response.headers.get('set-cookie');
        if (raw) setCookies = [raw];
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const size = buffer.length;

      let data;
      let isJson = false;
      const contentType = responseHeaders['content-type'] || '';
      
      if (contentType.includes('application/json')) {
         try {
           data = JSON.parse(buffer.toString('utf-8'));
           isJson = true;
         } catch (e) {
           data = buffer.toString('utf-8');
         }
      } else if (contentType.includes('text/')) {
         data = buffer.toString('utf-8');
      } else {
         data = buffer.toString('base64');
      }

      res.json({
        status: response.status,
        statusText: response.statusText,
        time: endTime - startTime,
        size,
        headers: responseHeaders,
        cookies: setCookies,
        data,
        isJson
      });

    } catch (error: any) {
      const endTime = Date.now();
      res.json({
        status: 0,
        statusText: 'Error',
        time: endTime - startTime,
        size: 0,
        headers: {},
        data: error.message,
        isJson: false,
        error: error.message
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
