const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');

const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');

// =========================
// Load .env
// =========================

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');

    for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const equalsIndex = trimmed.indexOf('=');

        if (equalsIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim();

        process.env[key] = value;
    }
}

// =========================
// CORS
// =========================

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// =========================
// JSON response
// =========================

function sendJson(res, statusCode, payload) {
    setCorsHeaders(res);

    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify(payload));
}

// =========================
// Read request body
// =========================

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        req.on('data', chunk => {
            chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                const rawBody = Buffer.concat(chunks).toString('utf8');

                if (!rawBody) {
                    resolve({});
                    return;
                }

                resolve(JSON.parse(rawBody));
            } catch (error) {
                reject(new Error('Request body không hợp lệ.'));
            }
        });

        req.on('error', reject);
    });
}

// =========================
// Call Gemini API
// =========================

async function callGemini(message, apiKey) {
    const modelName = 'gemini-3.8-flash';

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: String(message).trim()
                    }
                ]
            }
        ],

        generationConfig: {
            thinkingConfig: {
                thinkingLevel: 'low'
            },
            maxOutputTokens: 500
        }
    };

    console.log('Calling Gemini...');
    console.log('Model:', modelName);
    console.log('Message:', message);

    const controller = new AbortController();

    // Timeout 60 seconds
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 60000);

    try {
        const response = await fetch(url, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },

            body: JSON.stringify(requestBody),

            signal: controller.signal
        });

        const rawText = await response.text();

        let data = {};

        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (error) {
            console.error('Gemini returned invalid JSON:');
            console.error(rawText);

            return {
                statusCode: 502,
                body: {
                    error: 'Gemini trả về dữ liệu không hợp lệ.'
                }
            };
        }

        console.log('Gemini status:', response.status);

        if (!response.ok) {
            console.error(
                'Gemini API error:',
                JSON.stringify(data, null, 2)
            );

            return {
                statusCode: response.status,
                body: {
                    error:
                        data?.error?.message ||
                        'Gemini API request failed.'
                }
            };
        }

        const reply =
            data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || '')
                .join('')
                .trim();

        if (!reply) {
            console.error(
                'Gemini response không có text:',
                JSON.stringify(data, null, 2)
            );

            return {
                statusCode: 200,
                body: {
                    reply: 'AI không có phản hồi.'
                }
            };
        }

        console.log('Gemini reply received.');

        return {
            statusCode: 200,
            body: {
                reply: reply
            }
        };

    } catch (error) {

        if (error.name === 'AbortError') {
            console.error('Gemini request timeout.');

            return {
                statusCode: 504,
                body: {
                    error:
                        'AI phản hồi quá lâu. Vui lòng thử lại.'
                }
            };
        }

        console.error('Gemini request error:', error);

        return {
            statusCode: 500,
            body: {
                error:
                    'Không thể kết nối Gemini: ' +
                    (error.message || 'Unknown error')
            }
        };

    } finally {
        clearTimeout(timeoutId);
    }
}

// =========================
// API Handler
// =========================

async function handleApi(req, res) {

    // CORS preflight
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);

        res.writeHead(200);
        res.end();

        return;
    }

    // Only POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        sendJson(res, 405, {
            error: 'Chỉ chấp nhận phương thức POST.'
        });

        return;
    }

    try {

        const body = await readRequestBody(req);

        const message = body.message;

        // Validate message
        if (!message || !String(message).trim()) {
            sendJson(res, 400, {
                error: 'Tin nhắn không được để trống.'
            });

            return;
        }

        // API key
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('GEMINI_API_KEY chưa được cấu hình.');

            sendJson(res, 500, {
                error: 'Chưa cấu hình GEMINI_API_KEY.'
            });

            return;
        }

        // Call Gemini
        const result = await callGemini(
            message,
            apiKey
        );

        sendJson(
            res,
            result.statusCode,
            result.body
        );

    } catch (error) {

        console.error('API error:', error);

        sendJson(res, 500, {
            error:
                'Lỗi hệ thống: ' +
                (error.message || 'Unknown error')
        });
    }
}

// =========================
// Static files
// =========================

function serveStatic(req, res) {

    const url = parse(req.url, true);

    const pathname =
        url.pathname === '/'
            ? '/index.html'
            : url.pathname;

    const safePath = path.normalize(
        path.join(rootDir, pathname)
    );

    // Prevent path traversal
    if (!safePath.startsWith(rootDir)) {
        sendJson(res, 403, {
            error: 'Forbidden'
        });

        return;
    }

    fs.readFile(safePath, (err, data) => {

        if (err) {
            sendJson(res, 404, {
                error: 'Not found'
            });

            return;
        }

        const ext =
            path.extname(safePath).toLowerCase();

        const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.ico': 'image/x-icon'
        };

        res.writeHead(200, {
            'Content-Type':
                mimeTypes[ext] ||
                'application/octet-stream'
        });

        res.end(data);
    });
}

// =========================
// HTTP Server
// =========================

const server = http.createServer(
    async (req, res) => {

        const url = parse(req.url, true);

        // API
        if (url.pathname === '/api/sever') {
            await handleApi(req, res);
            return;
        }

        // Static files
        serveStatic(req, res);
    }
);

// =========================
// Start server
// =========================

if (require.main === module) {

    const port =
        process.env.PORT || 3000;

    server.listen(port, () => {

        console.log(
            `Server đang chạy tại http://localhost:${port}`
        );

        console.log(
            `Gemini API: /api/sever`
        );

        console.log(
            `Model: gemini-3.8-flash`
        );
    });
}

module.exports = {
    server,
    handleApi,
    serveStatic
};