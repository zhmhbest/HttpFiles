import * as path from 'path';
import * as fs from 'fs';
console.log("Hello", path.resolve("."));

import { HttpApp } from './lib/http';
const app = new HttpApp();
app.on(/^\/$/, async (m, req, res) => {
    // 重定向
    res.setHeader("location", "/hello");
    res.writeHead(302);
    res.end();
});
app.on(['GET', /^\/hello$/], async (match, req, res) => {
    return "Hello";
});
app.on(/^\/test$/, async (match, req, res) => {
    let body; await HttpApp.getBody(req).then(r => body = r.toString());
    return {
        body: JSON.stringify({
            match: match,
            method: req.method,
            headers: req.headers,
            body: body,
        }),
        status: 201,
        headers: {
            'content-type': 'text/json'
        }
    };
});
app.onApi(/^\/api/, async (match, method, status, headers, query) => {
    return {
        body: {
            match,
            method,
            status,
            headers,
            query,
        }
    };
});
app.listen();
