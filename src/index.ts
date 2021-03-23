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
app.on(/^\/$/, (m, req, res) => {
    // 重定向
    res.setHeader("location", "/hello");
    res.writeHead(302);
    res.end();
});
app.on(['GET', /^\/hello$/], (m, req, res) => {
    res.write("Hello");
    res.end();
});
app.listen();