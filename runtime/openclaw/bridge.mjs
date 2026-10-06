/* global process, Buffer, clearTimeout, setTimeout */
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

const MAX_REQUEST_BYTES = 1_048_576;
const MAX_RESPONSE_BYTES = 2_097_152;
const MAX_PENDING = 16;
const allowed = new Map([
  ['/v1/chat/completions', 'INFERENCE'],
  ['/broker/research/search', 'RESEARCH_SEARCH'],
  ['/broker/research/fetch', 'RESEARCH_FETCH'],
  ['/broker/research/download', 'RESEARCH_DOWNLOAD'],
  ['/broker/resource/read', 'RESOURCE_READ'],
  ['/broker/declared-api/invoke', 'DECLARED_API'],
]);
const pending = new Map();

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function completionEvents(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.choices) ||
    result.choices.length !== 1 || typeof result.id !== 'string' ||
    typeof result.model !== 'string' || !Number.isSafeInteger(result.created)) {
    throw new Error('INVALID_COMPLETION');
  }
  const choice = result.choices[0];
  const message = choice?.message;
  if (!message || message.role !== 'assistant' ||
    (message.content !== null && typeof message.content !== 'string') ||
    (message.tool_calls !== undefined && !Array.isArray(message.tool_calls)) ||
    !['stop', 'tool_calls', 'length'].includes(choice.finish_reason)) throw new Error('INVALID_COMPLETION');
  const base = { id: result.id, object: 'chat.completion.chunk', created: result.created,
    model: result.model };
  const data = [
    { ...base, choices: [{ index: 0, delta: { role: 'assistant',
      ...(message.content ? { content: message.content } : {}),
      ...(message.tool_calls ? { tool_calls: message.tool_calls.map((call, index) => ({
        index, id: call.id, type: 'function', function: call.function,
      })) } : {}),
    }, finish_reason: null }] },
    { ...base, choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason }],
      ...(result.usage ? { usage: result.usage } : {}) },
  ];
  const body = `${data.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`;
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) throw new Error('LIMIT');
  return body;
}

createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', (line) => {
  if (Buffer.byteLength(line) > MAX_RESPONSE_BYTES) process.exit(72);
  let message;
  try { message = JSON.parse(line); } catch { process.exit(72); }
  if (!message || typeof message.id !== 'string' || typeof message.ok !== 'boolean') process.exit(72);
  const active = pending.get(message.id);
  if (!active) process.exit(72);
  pending.delete(message.id);
  clearTimeout(active.timer);
  active.resolve(message);
});
process.stdin.on('end', () => process.exit(73));

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(204); response.end(); return;
  }
  const kind = request.method === 'POST' ? allowed.get(request.url) : undefined;
  if (!kind || pending.size >= MAX_PENDING || request.headers['content-type']?.split(';')[0] !== 'application/json') {
    response.writeHead(403); response.end(); return;
  }
  let size = 0;
  const chunks = [];
  try {
    for await (const chunk of request) {
      size += chunk.byteLength;
      if (size > MAX_REQUEST_BYTES) throw new Error('LIMIT');
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const id = randomUUID();
    const reply = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('TIMEOUT')); }, 30_000);
      pending.set(id, { resolve, timer });
      send({ type: 'REQUEST', id, kind, payload });
    });
    if (reply.ok && kind === 'INFERENCE' && payload?.stream === true) {
      const body = completionEvents(reply.result);
      response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache', 'content-length': Buffer.byteLength(body) });
      response.end(body); return;
    }
    const body = JSON.stringify(reply.ok ? reply.result : { error: { code: 'BROKER_DENIED' } });
    if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) throw new Error('LIMIT');
    response.writeHead(reply.ok ? 200 : 403, { 'content-type': 'application/json',
      'content-length': Buffer.byteLength(body) });
    response.end(body);
  } catch {
    response.writeHead(503); response.end();
  }
});
server.on('error', () => process.exit(74));
server.listen(8787, '127.0.0.1', () => send({ type: 'READY', protocolVersion: 1 }));
