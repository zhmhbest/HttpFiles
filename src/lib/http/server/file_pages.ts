import * as path from "path";
import * as fs from "fs";
import { IncomingMessage, ServerResponse } from "http";
import { formatFileSize, getPureExtensionName } from "../../file";
import { getPrism } from "./file_prism";
import { getMimeTypeByExtname } from "./file_mime";

interface HttpFileRange {
    start: number,
    end: number
}
const getFileRange = (filestat: fs.Stats, filerange?: string): HttpFileRange => {
    // req.headers['content-range']
    let range = {
        start: 0,
        end: filestat.size - 1
    } as HttpFileRange;
    if (filerange) {
        const rangeMatcher = /bytes=(?<start>\d+)-(?<end>\d+|$)/;
        const match = filerange.match(rangeMatcher);
        if (match) {
            const groups = match.groups as { start?: string, end?: string, size?: string };
            if (groups.start) range.start = parseInt(groups.start);
            if (groups.end) range.end = parseInt(groups.end);
        }
    }
    return range;
}

export const responseFile = (req: IncomingMessage, res: ServerResponse, fileName: string, fileStat: fs.Stats) => new Promise<void>((resolve, rejects) => {
    const extName = getPureExtensionName(fileName);
    const prismInfo = getPrism(extName);
    if (undefined === prismInfo) {
        // 【文件流】
        const fileRange = getFileRange(fileStat, req.headers['range']);
        // console.log(req.headers['range'], fileRange);
        // Head
        res.setHeader('Content-Type', getMimeTypeByExtname(extName));
        res.setHeader('Content-Range', `bytes ${fileRange.start}-${fileRange.end}/${fileStat.size}`);
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

const formatDate = (toFormat? : Date | string | number, formatType?: string) => {
    if (undefined === toFormat)
        toFormat = new Date();
    else
        toFormat = (toFormat instanceof Date) ? toFormat : new Date(toFormat);
    formatType = formatType || 'y-M-d h:m:s';

    const buf: Array<string | number> = [];
    for(let i=0; i<formatType.length; i++) {
        let ch = formatType.substr(i, 1);
        switch(ch) {
            case 'y': buf.push(toFormat.getFullYear()); break;
            case 'M': buf.push(toFormat.getMonth()+1); break;
            case 'd': buf.push(toFormat.getDate()); break;
            case 'H': buf.push(toFormat.getHours()); break;
            case 'm': buf.push(toFormat.getMinutes()); break;
            case 's': buf.push(toFormat.getSeconds()); break;
            case 'S': buf.push(toFormat.getMilliseconds()); break;
            default: buf.push(ch); break;
        }
    }
    return buf.join('');
};


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
svg{wdith: 32px; height:32px}
</style></head>`.trimLeft());
    // ----------------------------------------------------------------
    // Body
    res.write(`
<body><div class='main'>
<h2>${0 === topPathName.length ? '/' : topPathName}</h2>
<table>
    <thead><tr>
            <td style="width: 32px;"></td>
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
            res.write(`<td>`);
            if(fileStat.isDirectory()) {
                res.write('<svg style="color: Goldenrod;" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path><path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"></path></svg>');
            } else {
                res.write('<svg style="color: LightBlue;" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path></svg>');
            }
            res.write(`</td>`);
            res.write(`<td><a href='${pathName}'>${name}</a></td>`);
            res.write(`<td>${fileStat.isDirectory() ? '' : formatFileSize(fileStat.size)}</td>`);
            res.write(`<td>${fileStat.isDirectory() ? '' : formatDate(fileStat.ctime, 'y-M-d H:m:s')}</td>`);
            res.write(`<td>${fileStat.isDirectory() ? '' : formatDate(fileStat.mtime, 'y-M-d H:m:s')}</td>`);
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