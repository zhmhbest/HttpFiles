import * as path from "path";
import * as fs from "fs";
import { IncomingMessage, ServerResponse } from "http";
import { formatFileSize, getPureExtensionName } from "../../file";
import { getPrism } from "./file_prism";
import { getMimeTypeByExtname } from "./file_mime";

interface HttpFileRange {
    start: number,
    end: number,
    size: number
}
const getFileRange = (filestat: fs.Stats, filerange?: string): HttpFileRange => {
    // req.headers['content-range']
    let range = {
        start: 0,
        end: filestat.size - 1,
        size: filestat.size
    } as HttpFileRange;
    if (filerange) {
        const rangeMatcher = /bytes (?<L>\*|(?<start>\d+)-(?<end>\d+))(?<R>\/(?<size>\*|\d+))?/;
        const match = filerange.match(rangeMatcher);
        if (match) {
            const groups = match.groups as { start?: string, end?: string, size?: string };
            if (groups.start) range.start = parseInt(groups.start);
            if (groups.end) range.end = parseInt(groups.end);
            if (groups.size) range.size = parseInt(groups.size);
        }
    }
    return range;
}

export const responseFile = (req: IncomingMessage, res: ServerResponse, fileName: string, fileStat: fs.Stats) => new Promise<void>((resolve, rejects) => {
    const extName = getPureExtensionName(fileName);
    const prismInfo = getPrism(extName);
    if (undefined === prismInfo) {
        // 【文件流】
        const fileRange = getFileRange(fileStat, req.headers['content-range']);
        // Head
        res.setHeader('Content-Type', getMimeTypeByExtname(extName));
        res.setHeader('Content-Length', (fileRange.end - fileRange.start + 1));
        // Body
        fs.createReadStream(fileName, {
            flags: 'r',
            autoClose: true,
            start: fileRange.start,
            end: fileRange.end
        }).on('data', (chunk: Buffer) => {
            // console.log(chunk.length); // 65536
            res.write(chunk);
        }).on('end', () => {
            res.end();
            resolve();
        });
    } else {
        // 【代码预览】
        const [sourceName, languageName, cdnURL] = prismInfo;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.write('<html>');
        res.write('<head>');
        res.write('<style>body{color:grey;background-color:#333333;width:80%;margin-left:10%;margin-right:10%;}</style>');
        res.write('</head>');
        res.write('<body>');
        // Toolbar
        res.write(`<div class="toolbar"><button onclick="setClipboardText(document.querySelector('.main>pre>code').innerText)">复制代码</button></div>`);
        res.write('<script>function setClipboardText(value){const text=document.createElement("textarea");text.value=value;document.body.appendChild(text);text.select();document.execCommand("Copy");text.remove();}</script>');
        // Code
        res.write('<div class="main">');
        const text = fs.readFileSync(fileName, { encoding: 'utf8' }).toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        res.write(`<pre class="line-numbers" data-download-link data-download-link-label="Download this file"><code class="match-braces rainbow-braces ${languageName}">${text}</code></pre>`);
        res.write('</div>');
        // 基本功能
        res.write(`<script src="${cdnURL}/prism.min.js"></script>`);
        res.write(`<link href="${cdnURL}/themes/prism-tomorrow.min.css" rel="stylesheet">`);
        if (sourceName) {
            res.write(`<script src="${cdnURL}/components/${sourceName}.min.js"></script>`);
        }
        // 扩展功能-行号
        res.write(`<link href="${cdnURL}/plugins/line-numbers/prism-line-numbers.min.css" rel="stylesheet">`);
        res.write(`<script src="${cdnURL}/plugins/line-numbers/prism-line-numbers.min.js"></script>`);
        // 扩展功能-括号
        res.write(`<link href="${cdnURL}/plugins/match-braces/prism-match-braces.min.css" rel="stylesheet">`);
        res.write(`<script src="${cdnURL}/plugins/match-braces/prism-match-braces.min.js"></script>`);
        res.write('</body>');
        res.write('</html>');
        res.end();
        resolve();
    }
});

export const responseDirectory = (res: ServerResponse, topFileName: string, topPathName: string): void => {
    // 返回目录
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const fileNames = fs.readdirSync(topFileName);
    res.write('<html>');
    // ----------------------------------------------------------------
    // Head
    res.write(`
<head><style>
body{font-size:150%;font-family:serif;color:#999999;background-color:#333333}
table{width:100%}tr{margin-top:8px}tr:hover{background-color: black}
a{text-decoration:none}a:link{color:pink}a:visited{color:hotpink}
.main{margin-left:6%;margin-right:6%}
</style></head>`.trimLeft());
    // ----------------------------------------------------------------
    // Body
    res.write(`
<body><div class='main'>
<h2>${0 === topPathName.length ? '/' : topPathName}</h2>
<table>
    <thead><tr>
            <td>□</td>
            <td><a href='${topPathName}/..'>..</a></td>
            <td>文件大小</td>
            <td>创建时间</td>
            <td>修改时间</td>
    </tr></thead>
<tbody>`.trimLeft());
    // --------------------------------
    for (let name of fileNames) {
        if (name.startsWith('$') || name.startsWith('.')) continue;
        try {
            const fileName = path.join(topFileName, name);
            const pathName = `${topPathName}/${name}`;
            const fileStat = fs.statSync(fileName);
            res.write(`<tr>`);
            res.write(`<td>${fileStat.isDirectory() ? '□' : '■'}</td>`);
            res.write(`<td><a href='${pathName}'>${name}</a></td>`);
            res.write(`<td>${fileStat.isDirectory() ? '' : formatFileSize(fileStat.size)}</td>`);
            res.write(`<td>${fileStat.isDirectory() ? '' : fileStat.ctime.toLocaleString()}</td>`);
            res.write(`<td>${fileStat.isDirectory() ? '' : fileStat.mtime.toLocaleString()}</td>`);
            res.write(`</tr>\n`);
        } catch (err) { continue; }
    }
    // --------------------------------
    res.write(`
</tbody>
</table>
</div></body>`.trimLeft());
    // ----------------------------------------------------------------
    res.write('</html>');
    res.end();
}