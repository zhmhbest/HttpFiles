import * as fs from "fs";
import * as http from "http";
import { Server, IncomingMessage, ServerResponse, IncomingHttpHeaders } from "http";
import * as querystring from "querystring";
import * as multiparty from "multiparty";
import { getMimeTypeByExtname } from "./mimetype";

// Path
export type HttpMethodType =
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' |
    'COPY' | 'HEAD' | 'OPTIONS' |
    'LINK' | 'UNLINK' | 'PURGE' | 'LOCK' | 'UNLOCK' | 'PROPFIND'
    ;
export type HttpPathMatcher = string | RegExp;
export type HttpComposedPathIdentity =
    HttpPathMatcher |
    [
        HttpMethodType | Array<HttpMethodType> | undefined,
        HttpPathMatcher
    ]
    ;

// Event
export interface HttpEasyResponse {
    body: any,
    status?: number,
    headers?: IncomingHttpHeaders
};
export type HttpRequestEventResultType = void | string | HttpEasyResponse;
export type HttpRequestEvent = (
    match: RegExpMatchArray,
    req: IncomingMessage,
    res: ServerResponse
) => Promise<HttpRequestEventResultType>;

// RequestInterface
export interface HttpRequestInterface {
    method?: Set<HttpMethodType>,
    pathname: RegExp,
    event: HttpRequestEvent
}


/**
 * 返回“请求错误”响应
 * @param res
 * @param code 错误码
 * @param message 错误信息
 */
export const errorMessage = (res: ServerResponse, code: number, message: string): void => {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(code);
    res.write(`<style>body{color:grey;background-color:#333333;width:80%;margin-left:10%;margin-right:10%;}h1{color:red;}</style>`);
    res.write(`<h1>Error</h1>`);
    res.write(`<p>${message}</p>`);
    res.end();
}
export const error403 = (res: ServerResponse, msg?: string): void => errorMessage(res, 403, msg || "Forbidden!");
export const error404 = (res: ServerResponse, msg?: string): void => errorMessage(res, 404, msg || "Not Found!");
export const error500 = (res: ServerResponse, msg?: string): void => errorMessage(res, 500, msg || "Internal Server Error!");

/**
 * 返回文件流
 */
export const responseFileStream = (req: IncomingMessage, res: ServerResponse, fileName: string, extName: string, fileStat: fs.Stats) => new Promise<void>((resolve, reject) => {
    // fileRange
    let fileRange = {
        start: 0,
        end: fileStat.size - 1
    } as { start: number, end: number };
    const headerRange = req.headers['range'];
    if (headerRange) {
        // bytes=0-(fileSize - 1)
        const matches = headerRange.match(/bytes=(?<start>\d+)-(?<end>\d+|$)/);
        // console.log(matches);
        if (matches) {
            const groups = matches.groups as { start?: string, end?: string };
            if (groups.start && groups.start.length > 0) fileRange.start = parseInt(groups.start);
            if (groups.end && groups.end.length > 0) fileRange.end = parseInt(groups.end);
            // bytes 0-(fileSize - 1)/fileSize
            // res.writeHead(206);
            res.setHeader('Content-Range', `bytes ${fileRange.start}-${fileRange.end}/${fileStat.size}`);
        }
    }
    // Stream
    res.setHeader('Content-Type', getMimeTypeByExtname(extName));
    // end - start + 1
    res.setHeader('Content-Length', (fileRange.end - fileRange.start + 1));
    fs.createReadStream(fileName, {
        flags: 'r',
        autoClose: true,
        start: fileRange.start,
        end: fileRange.end
    }).on('data', (chunk: Buffer) => {
        res.write(chunk);
    }).on('end', () => {
        res.end();
        resolve();
    });
});


/**
 * 重定向到本地其它路径
 * @param res
 * @param pathname
 */
export const redirectLocalPath = (res: ServerResponse, pathname: string): void => {
    res.setHeader("Location", pathname);
    res.writeHead(302);
    res.end();
}

/**
 * 获得不以“/”结尾的路径
 * @param pathname
 * @returns
 */
export const getPurePath = (pathname: string): string => {
    return pathname.endsWith('/') ? pathname.substr(0, pathname.length - 1) : pathname;
}

/**
 * (异步)获取请求体全部内容
 * @param req
 * @returns
 */
export const getRequestBody = (req: IncomingMessage) => new Promise<Buffer>((resolve, rejects) => {
    const buffer: Array<Buffer> = [];
    req.on('error', (err: Error) => rejects(err));
    req.on('data', (chunk: Buffer) => buffer.push(chunk));
    req.on('end', () => {
        resolve(Buffer.concat(buffer));
    });
});

/**
 * (异步)获取请求参数
 * @param req
 * @returns
 */
export const getRequestQuery = (req: IncomingMessage) => new Promise<NodeJS.Dict<any>>((resolve, rejects) => {
    const s = req.url || '';
    const l = s.indexOf('?');
    if (l >= 0) {
        // Line
        const qs = s.substr(l + 1);
        resolve({ ...querystring.parse(qs) });
    } else {
        // Body
        const contentType = req.headers['content-type'];
        if (undefined === contentType) {
            // rejects(new Error('Undefined Content-Type!')); return;
            resolve({}); return;
        }
        // FormData
        if ('multipart/form-data' === contentType.split(';', 1)[0]) {
            const formData = new multiparty.Form();
            formData.parse(req, (error: Error, fields: any, files: any) => {
                if (error) {
                    rejects(error);
                }
                resolve({ ...fields, ...files });
            });
        } else {
            // WWW
            getRequestBody(req).then(body => {
                resolve({ ...querystring.parse(body.toString('utf-8')) });
            });
        }
    }
});

/**
 * HttpBaseApp
 */
export class HttpBaseApp {
    protected m_port: number;
    protected m_host: string | undefined;
    protected m_server: Server | null;
    protected m_interfaces: Array<HttpRequestInterface>;

    public constructor(port?: number, host?: string) {
        this.m_port = port || 8899;
        this.m_host = host || undefined;
        this.m_server = null;
        this.m_interfaces = [];
    }

    public on(
        pathname: HttpComposedPathIdentity,
        event: HttpRequestEvent
    ): void {
        let item = {} as HttpRequestInterface;
        let pn: HttpPathMatcher;
        if (pathname instanceof Array) {
            // Mthodtype, Pathname
            const mt = pathname[0];
            pn = pathname[1];
            if (undefined === mt) {
                item.method = undefined;
            } else {
                const mts = new Set<HttpMethodType>();
                if (typeof mt === 'string') {
                    mts.add(mt.toUpperCase() as HttpMethodType)
                } else {
                    for (let item of mt) {
                        mts.add(item.toUpperCase() as HttpMethodType)
                    }
                }
                item.method = mts;
            }
        } else {
            // Undefined, Pathname
            item.method = undefined;
            pn = pathname;
        }
        if (pn instanceof RegExp) {
            item.pathname = pn;
        } else {
            item.pathname = new RegExp(`^${pn}($|\\?)`);
        }
        item.event = event;
        this.m_interfaces.push(item);
    }

    public listen(): void {
        this.m_server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            const pathName = req.url ? req.url.toString() : '/';
            // req.on('error', (err) => {
            //     error500(res);
            // });
            // res.on('error', (err) => {
            //     error500(res);
            // });
            try {
                // 匹配链接
                let isNotMatched = true;
                for (let item of this.m_interfaces) {
                    // 验证Method
                    const requestMethod = req.method;
                    if (
                        undefined === requestMethod ||
                        undefined !== item.method &&
                        !item.method.has(requestMethod.toUpperCase() as HttpMethodType)
                    ) continue;
                    // 验证Pathname
                    const matches = pathName.match(item.pathname);
                    if (null == matches) continue;
                    // 智能返回
                    item.event(matches, req, res).then(result => {
                        if (undefined !== result) {
                            if ('string' === typeof result) {
                                res.write(result);
                            } else {
                                if (result.headers) {
                                    for (let item of Object.keys(result.headers)) {
                                        res.setHeader(item, result.headers[item] as string)
                                    }
                                }
                                if(result.status) res.writeHead(result.status);
                                res.write(result.body);
                            }
                        }
                        // 保证匹配成功后连接一定关闭
                        res.end();
                    });
                    // 匹配成功，退出循环
                    isNotMatched = false;
                    break;
                }
                // 未匹配返回404
                if (isNotMatched) {
                    error404(res);
                }
            } catch (err) {
                error500(res);
            }
            // 记录访问日志
            console.log(`${req.socket.remoteAddress} ${undefined === req.method ? '*' : req.method} ${pathName}`);
        });

        this.m_server.listen(this.m_port, this.m_host, () => {
            for (let item of this.m_interfaces) {
                console.log(`- ${undefined === item.method ? '*' : [...item.method]} ${item.pathname}`);
            }
            console.log(`Web Server started at http://${this.m_host ? this.m_host : '127.0.0.1'}:${this.m_port}`);
        });
    }
}