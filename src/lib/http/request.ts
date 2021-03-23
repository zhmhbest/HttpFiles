import * as http from "http";
import * as https from "https";
import { IncomingMessage, IncomingHttpHeaders, RequestOptions } from "http";

interface RequestConfig {
    url: URL | string,
    method?: 'GET' | 'POST' | string,
    headers?: IncomingHttpHeaders,
    body?: IncomingMessage | Array<any>,
    waitHeader?: (status: number, headers: IncomingHttpHeaders) => void,
    waitChunk?: (chunk: Buffer) => void
}

export const request = (
    config: RequestConfig
) => new Promise<any>((resolve, rejects) => {
    const url = config.url instanceof URL ? config.url : new URL(config.url);
    const options = [] as RequestOptions;
    options.method = config.method || 'GET';
    if (undefined !== config.headers) {
        config.headers['host'] = url.host;
        options.headers = config.headers;
    }
    // ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
    const req = ('http:' === url.protocol ? http : https).request(url, options, (res: http.IncomingMessage) => {
        // 响应头
        if (undefined !== config.waitHeader) {
            config.waitHeader(res.statusCode || 500, res.headers);
        }
        // 响应体
        if (undefined !== config.waitChunk) {
            // 立即返回
            const waitChunk = config.waitChunk;
            res.on('data', (chunk: Buffer) => { waitChunk(chunk); });
            res.on('end', () => { resolve(undefined) });
        } else {
            // 缓存返回
            const buffer: Array<Buffer> = [];
            res.on('data', (chunk: Buffer) => { buffer.push(chunk); });
            res.on('end', () => { resolve(Buffer.concat(buffer)) });
        }
    });
    req.on('error', (err) => {
        rejects(err);
    });
    // ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
    const chunks = config.body;
    if (undefined === chunks) {
        req.end()
    } else {
        if (chunks instanceof IncomingMessage) {
            chunks.on('data', (chunk: Buffer) => { req.write(chunk) });
            chunks.on('end', () => { req.end() })
        } else {
            for (let chunk of chunks) { req.write(chunk) }
            req.end()
        }
    }
});