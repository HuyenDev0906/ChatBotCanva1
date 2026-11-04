const test = require('node:test');
const assert = require('node:assert/strict');
const { server, callGeminiStream, getQuickGreetingReply } = require('./server');

test('answers simple greetings locally without calling Gemini', async () => {
    assert.ok(getQuickGreetingReply('Chào mình bằng một câu ngắn nhé.'));
    assert.equal(getQuickGreetingReply('Chào, mình đang bị bắt nạt.'), null);

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const startedAt = performance.now();
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/server`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Chào mình bằng một câu ngắn nhé.', stream: true })
        });
        const reader = response.body.getReader();
        const firstChunk = await reader.read();
        const elapsedMs = performance.now() - startedAt;
        const followingChunk = await reader.read();

        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /text\/event-stream/);
        assert.ok(elapsedMs < 1000, `Greeting took ${elapsedMs.toFixed(0)}ms`);
        assert.match(new TextDecoder().decode(firstChunk.value), /Lá Chắn Xanh AI/);
        assert.equal(followingChunk.done, true);
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
});

function geminiEvent(text) {
    return `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text }] } }]
    })}\n\n`;
}

test('forwards Gemini SSE text as soon as each chunk is received', async () => {
    const originalFetch = global.fetch;
    const encoder = new TextEncoder();
    const firstEvent = geminiEvent('Xin chào');
    const secondEvent = geminiEvent(' bạn!');
    const chunks = [
        firstEvent.slice(0, 17),
        firstEvent.slice(17) + secondEvent
    ];

    global.fetch = async url => {
        assert.match(url, /:streamGenerateContent\?alt=sse$/);
        return new Response(new ReadableStream({
            start(controller) {
                chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
                controller.close();
            }
        }), { status: 200 });
    };

    try {
        const received = [];
        const result = await callGeminiStream('Xin chào', 'test-key', [], text => {
            received.push(text);
        });

        assert.equal(result.ok, true);
        assert.equal(result.body.reply, 'Xin chào bạn!');
        assert.deepEqual(received, ['Xin chào', ' bạn!']);
    } finally {
        global.fetch = originalFetch;
    }
});

test('returns a clear error when Gemini rejects a streaming request', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(
        JSON.stringify({ error: { message: 'Unavailable' } }),
        { status: 503 }
    );

    try {
        const result = await callGeminiStream('Xin chào', 'test-key', [], () => {});

        assert.equal(result.ok, false);
        assert.equal(result.statusCode, 503);
        assert.ok(result.body.error);
    } finally {
        global.fetch = originalFetch;
    }
});