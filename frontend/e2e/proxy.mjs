import http from 'node:http';

const target = new URL(
  process.env.PLAYWRIGHT_TARGET_URL ?? 'http://host.docker.internal:8080'
);
const port = Number(process.env.PLAYWRIGHT_PROXY_PORT ?? 4173);

const server = http.createServer((request, response) => {
  const upstream = http.request(
    new URL(request.url ?? '/', target),
    {
      headers: {
        ...request.headers,
        host: target.host
      },
      method: request.method
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers
      );
      upstreamResponse.pipe(response);
    }
  );

  upstream.on('error', (error) => {
    response.writeHead(502, { 'Content-Type': 'text/plain' });
    response.end(`Upstream unavailable: ${error.message}`);
  });
  request.pipe(upstream);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Playwright proxy listening on http://localhost:${port}`);
});
