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
                return 'text/html';
            case '.js':
                return 'text/javascript';
            case '.css':
                return 'text/css';
            case '.txt':
            case '.text':
                return 'text/plain';
            case '.ttf':
                return 'font/ttf';
            // 数据
            case '.json':
                return 'application/json';
            case '.xml':
                return 'application/xml';
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

    public onFile(prefix: string, dirpath: string): void {
        // prefix
        prefix = prefix.endsWith('/') ? prefix.substr(0, prefix.length - 1) : prefix;
        // interface
        this.m_interfaces.push({
            method: 'GET',
            pathname: new RegExp(`^${prefix}($|/.*$)`),
            event: (match, req, res) => new Promise<void | string | HttpEasyResponse>((resolve, rejects) => {
                const aliasName = decodeURI(match[1].endsWith('/') ? match[1].substr(0, match[1].length - 1) : match[1]);
                try {
                    // 获取文件名、判断是否存在
                    const topFileName = path.join(dirpath, aliasName);
                    const topFileState = fs.statSync(topFileName);
                    if (topFileState.isDirectory()) {
                        // 返回目录
                        res.setHeader('content-type', 'text/html; charset=utf-8');
                        const fileNames = fs.readdirSync(topFileName);
                        res.write('<style>body{font-size:150%;color:white;background-color:black}a{text-decoration:none}a:link{color: pink}a:visited{color: hotpink}</style>');
                        res.write('<ul>');
                        // 返回上级
                        res.write(`<li style='list-style:circle'}'><a href='${prefix}${aliasName}/..'>../</a></li>\n`);
                        for (let name of fileNames) {
                            const fileName = path.join(topFileName, name);
                            let fileStat;
                            let realName;
                            let showName;
                            try {
                                fileStat = fs.statSync(fileName);
                                realName = `${prefix}${aliasName}/${name}`;
                                showName = path.basename(`${aliasName}/${name}`);
                                res.write(`<li style='margin-top: 5px; list-style:${fileStat.isDirectory()?'circle':'disc'}'><a href='${realName}'>${showName}</a></li>\n`);
                            } catch(err) {}
                        }
                        res.write('</ul>');
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
