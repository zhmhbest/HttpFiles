import * as querystring from "querystring";
import * as multiparty from "multiparty";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { Server, IncomingMessage, ServerResponse, IncomingHttpHeaders } from "http";

type HttpMethodType =
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' |
    'COPY' | 'HEAD' | 'OPTIONS' |
    'LINK' | 'UNLINK' | 'PURGE' | 'LOCK' | 'UNLOCK' | 'PROPFIND'
type HttpPathMatcher = string | RegExp;

interface HttpEasyResponse {
    body: any,
    status?: number,
    headers?: IncomingHttpHeaders
};

type HttpRequestEvent = (
    match: RegExpMatchArray,
    req: IncomingMessage,
    res: ServerResponse
) => Promise<void | string | HttpEasyResponse>;

type HttpRequestApiEvent = (
    match: RegExpMatchArray,
    method: HttpMethodType,
    status: number,
    headers: IncomingHttpHeaders,
    query: NodeJS.Dict<any>
) => Promise<void | string | HttpEasyResponse>;

interface HttpRequestInterface {
    method?: HttpMethodType,
    pathname: HttpPathMatcher,
    event: HttpRequestEvent
}

export class HttpApp {
    protected m_port: number;
    protected m_host: string;
    protected m_server: Server | null;
    protected m_interfaces: Array<HttpRequestInterface>;
    public constructor(port?: number, host?: string) {
        this.m_port = port || 8899;
        this.m_host = host || "127.0.0.1";
        this.m_server = null;
        this.m_interfaces = [];
    }

    // 异步
    public static getBody(req: IncomingMessage) {
        return new Promise<Buffer>((resolve, rejects) => {
            const buffer: Array<Buffer> = [];
            req.on('error', (err) => {
                rejects(err);
            });
            req.on('data', (chunk) => {
                buffer.push(chunk);
            });
            req.on('end', () => {
                resolve(Buffer.concat(buffer));
            });
        });
    }

    // 异步
    public static getQuery(req: IncomingMessage) {
        return new Promise<NodeJS.Dict<any>>((resolve, rejects) => {
            const s = req.url || '';
            const l = s.indexOf('?');
            if (l >= 0) {
                // Line
                const qs = s.substr(s.indexOf('?') + 1);
                resolve({ ...querystring.parse(qs) });
            } else {
                // Body
                const contentType = req.headers['content-type'];
                if (undefined === contentType) { rejects(new Error('Undefined Content-Type!')); return; }
                // FormData
                if ('multipart/form-data' === contentType.split(';', 1)[0]) {
                    const form = new multiparty.Form();
                    form.parse(req, (error: Error, fields: any, files: any) => {
                        if (error) {
                            rejects(error);
                        }
                        resolve({ ...fields, ...files });
                    });
                } else {
                    // WWW
                    HttpApp.getBody(req).then(body => {
                        resolve({ ...querystring.parse(body.toString('utf-8')) });
                    });
                }
            }
        });
    }

    // 同步
    public static getMimeType(fileName: string): string {
        const extName = path.extname(fileName).toLowerCase();
        switch (extName) {
            case '.htm':
            case '.html':
                return 'text/html; charset=utf-8';
            case '.js':
                return 'text/javascript; charset=utf-8';
            case '.css':
                return 'text/css; charset=utf-8';
            case '.txt':
            case '.text':
            case '.md':
            case '.sql':
                return 'text/plain; charset=utf-8';
            case '.ttf':
                return 'font/ttf';
            // 数据
            case '.json':
                return 'application/json';
            case '.xml':
                return 'application/xml';
            case '.csv':
                return 'application/csv';
            // 图片
            case '.ico':
                return 'image/x-icon';
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.png':
                return 'image/png';
            case '.bmp':
                return 'image/bmp';
            case '.gif':
                return 'image/gif';
            case '.svg':
                return 'image/svg+xml';
            // 媒体
            case '.mp3':
                return 'audio/mpeg';
            case '.mid':
            case '.midi':
                return 'audio/midi';
            case '.mp4':
                return 'video/mp4';
            // 默认
            default:
                return 'application/octet-stream';
        }
    }

    // 同步
    public static formatFileSize(fileSize: number): string {
        const UNIT = ["B", "K", "M", "G", "T", "P"];
        const UNIT_SIZE = UNIT.length;
        const UNIT_STEP = 1024;
        let unitIndex = 0;
        while (fileSize >= UNIT_STEP && unitIndex < UNIT_SIZE - 1) {
            unitIndex++;
            fileSize /= UNIT_STEP;
        }
        return `${fileSize.toFixed(2)}${UNIT[unitIndex]}`;
    }

    public on(pathname: HttpPathMatcher | [HttpMethodType, HttpPathMatcher], event: HttpRequestEvent): void {
        let item = {} as HttpRequestInterface;
        if (pathname instanceof Array) {
            item.method = pathname[0].toUpperCase() as HttpMethodType;
            item.pathname = pathname[1];
        } else {
            item.method = undefined;
            item.pathname = pathname;
        }
        item.event = event;
        this.m_interfaces.push(item);
    }

    public onApi(pathname: HttpPathMatcher | [HttpMethodType, HttpPathMatcher], event: HttpRequestApiEvent): void {
        let item = {} as HttpRequestInterface;
        if (pathname instanceof Array) {
            item.method = pathname[0].toUpperCase() as HttpMethodType;
            item.pathname = pathname[1];
        } else {
            item.method = undefined;
            item.pathname = pathname;
        }
        item.event = (match, req, res) => new Promise<void | string | HttpEasyResponse>((resolve, rejects) => {
            HttpApp.getQuery(req).then(query => {
                event(match, req.method as HttpMethodType, req.statusCode || 500, req.headers, query)
                    .then(r => {
                        if (r instanceof Object) {
                            // r = r as HttpEasyResponse;
                            r.body = JSON.stringify(r);
                            if (undefined === r.headers) {
                                r.headers = { 'content-type': 'application/json' };
                            } else {
                                r.headers['content-type'] = 'application/json';
                            }
                        }
                        resolve(r);
                    });
            });
        });
        this.m_interfaces.push(item);
    }

    public onFiles(prefix: string, dirpath: string): void {
        // prefix
        prefix = prefix.endsWith('/') ? prefix.substr(0, prefix.length - 1) : prefix;
        // interface
        this.m_interfaces.push({
            method: 'GET',
            pathname: new RegExp(`^${prefix}($|/.*$)`),
            event: (match, req, res) => new Promise<void | string | HttpEasyResponse>((resolve, rejects) => {
                const topAliasName = decodeURI(match[1].endsWith('/') ? match[1].substr(0, match[1].length - 1) : match[1]);
                const topPathName = `${prefix}${topAliasName}`;
                try {
                    // 获取文件名、判断是否存在
                    const topFileName = path.join(dirpath, topAliasName);
                    const topFileState = fs.statSync(topFileName);
                    if (topFileState.isDirectory()) {
                        // 返回目录
                        res.setHeader('content-type', 'text/html; charset=utf-8');
                        const fileNames = fs.readdirSync(topFileName);
                        // Head
                        res.write('<head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><style>');
                        res.write('body{font-size:150%;font-family:serif;color:#999999;background-color:#333333}');
                        res.write('table{width:100%}tr{margin-top:8px}tr:hover{background-color: black}');
                        res.write('a{text-decoration:none}a:link{color:pink}a:visited{color:hotpink}');
                        res.write('.main{margin-left:6%;margin-right:6%}');
                        res.write('</style></head>\n');
                        // Body
                        res.write(`<body><div class='main'><h2>${0 === topPathName.length ? '/' : topPathName}</h2><table>`);
                        // 返回上级
                        res.write(`<thead><tr>`);
                        res.write(`<td>□</td>`);
                        res.write(`<td><a href='${topPathName}/..'>..</a></td>`);
                        res.write(`<td>文件大小</td>`);
                        res.write(`<td>创建时间</td>`);
                        res.write(`<td>最近修改</td>`);
                        res.write(`</tr></thead><tbody>\n`);
                        for (let name of fileNames) {
                            if (name.startsWith('$') || name.startsWith('.')) continue;
                            try {
                                const fileName = path.join(topFileName, name);
                                const pathName = `${topPathName}/${name}`;
                                const fileStat = fs.statSync(fileName);
                                res.write(`<tr>`);
                                res.write(`<td>${fileStat.isDirectory() ? '□' : '■'}</td>`);
                                res.write(`<td><a href='${pathName}'>${name}</a></td>`);
                                res.write(`<td>${fileStat.isDirectory() ? '' : HttpApp.formatFileSize(fileStat.size)}</td>`);
                                res.write(`<td>${fileStat.isDirectory() ? '' : fileStat.ctime.toLocaleString()}</td>`);
                                res.write(`<td>${fileStat.isDirectory() ? '' : fileStat.mtime.toLocaleString()}</td>`);
                                res.write(`</tr>\n`);
                            } catch (err) { continue; }
                        }
                        res.write('</tbody></table></div></body>');
                        res.end();
                        resolve();
                    } else {
                        // 返回文件
                        res.setHeader('content-type', HttpApp.getMimeType(topFileName));
                        res.write(fs.readFileSync(topFileName, { flag: 'r' }));
                        res.end();
                        resolve();
                    }
                } catch (err) {
                    res.writeHead(404);
                    res.write("Not Found!");
                    res.end();
                    resolve();
                }
            })
        });
    }

    public listen(): void {
        this.m_server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            // 错误返回500
            res.on('error', (err) => {
                res.writeHead(500);
                res.write("Internal Server Error!");
                res.end();
            });
            const pathName = undefined === req.url ? '/' : req.url.toString();
            let isNotMatched = true;
            for (let item of this.m_interfaces) {
                // 验证Method
                if (undefined !== item.method && req.method !== item.method) continue;
                // 验证Pathname
                const match = pathName.match(item.pathname);
                if (null == match) continue;
                // 调用方法
                item.event(match, req, res).then(result => {
                    // 智能返回
                    if (undefined !== result) {
                        if ('string' === typeof result) {
                            res.writeHead(200);
                            res.write(result);
                        } else {
                            if (undefined !== result.headers) {
                                for (let item of Object.keys(result.headers)) {
                                    res.setHeader(item, result.headers[item] as string)
                                }
                            }
                            res.writeHead(undefined === result.status ? 200 : result.status);
                            res.write(result.body);
                        }
                    }
                    // 关闭连接
                    res.end();
                });
                // 退出循环
                isNotMatched = false;
                break;
            }
            // 未匹配返回404
            if (isNotMatched) {
                res.writeHead(404);
                res.write("Not Found!");
                res.end();
            }
            // 记录访问日志
            console.log(`${undefined === req.method ? '*' : req.method} ${pathName}`);
        });
        this.m_server.listen(this.m_port, this.m_host, () => {
            for (let item of this.m_interfaces) {
                console.log(`- ${undefined === item.method ? '*' : item.method} ${item.pathname}`);
            }
            console.log(`Web Server started at http://${this.m_host}:${this.m_port}`);
        });
    }
};
