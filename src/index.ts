import * as path from 'path';
import * as fs from 'fs';
console.log("Hello", path.resolve("."));

// import { request } from './lib/http';
// request({
//     url: "https://www.baidu.com/",
// }).then(res => {
//     console.log(res.toString());
// });

import { HttpApp } from './lib/http';
const app = new HttpApp();
app.on(/^\/$/, async (m, req, res) => {
    // 重定向
    res.setHeader("location", "/hello");
    res.writeHead(302);
    res.end();
});
app.on(['GET', /^\/hello$/], async (m, req, res) => {
    return "Hello";
});
app.on(['GET', /^\/test$/], async (m, req, res) => {
    return {
        body: "test",
        status: 201,
        headers: {
            'origin': '8888'
        }
    };
});
app.listen();