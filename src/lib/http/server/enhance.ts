import { IncomingHttpHeaders, ServerResponse } from "http";
import { request } from "../request";
import { errorMessage, getPurePath, getRequestQuery, HttpBaseApp, HttpComposedPathIdentity, HttpMethodType, HttpRequestEventResultType, redirectLocalPath } from "./base";

import * as path from "path";
import * as fs from "fs";
import { moveFile } from "../../file";
import { responseDirectoryHtml, responseFile } from "./pages";

export type HttpRequestApiEvent = (
    match: RegExpMatchArray,
    method: HttpMethodType,
    status: number,
    headers: IncomingHttpHeaders,
    query: NodeJS.Dict<any>
) => Promise<HttpRequestEventResultType>;

const error403 = (res: ServerResponse) => errorMessage(res, 403, "Forbidden!");
const error404 = (res: ServerResponse) => errorMessage(res, 404, "Not Found!");
const error500 = (res: ServerResponse) => errorMessage(res, 500, "Server Error!");

export class HttpApp extends HttpBaseApp {
    /**
     * API接口
     *  - body自动转化为JSON
     *  - 返回类型自动设置为JSON
     * @param pathname
     * @param event
     */
    public onApi(pathname: HttpComposedPathIdentity, event: HttpRequestApiEvent): void {
        this.on(pathname, (match, req, res) => new Promise<HttpRequestEventResultType>((resolve, rejects) => {
            getRequestQuery(req).then(query => {
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
        }));
    };

    /**
     * 访问代理
     * @param prefixPath
     * @param capturePath
     * @param captureChunk
     */
    public onMapping(
        prefixPath: string,
        capturePath: string | ((sub: string) => string | ((res: ServerResponse) => void)),
        captureChunk?: (chunk: Buffer | null) => void
    ): void {
        prefixPath = getPurePath(prefixPath);
        this.on([undefined, new RegExp(`^${prefixPath}($|/.*$)`)], (match, req, res) => new Promise<HttpRequestEventResultType>((resolve, rejects) => {
            let finalPath: string;
            if (typeof capturePath === 'string') {
                finalPath = `${capturePath}${decodeURI(match[1])}`;
            } else {
                const captured = capturePath(decodeURI(match[1]));
                if (typeof captured === 'string') {
                    finalPath = captured;
                } else if (captured instanceof Function) {
                    captured(res);
                    resolve(); return;
                } else {
                    error404(res);
                    resolve(); return;
                }
            }
            // 代理请求
            const url = new URL(finalPath);
            request({
                url: url,
                method: req.method,
                headers: { ...req.headers, host: `${url.host}` },
                body: req,
                waitHeader: (status: number, headers: IncomingHttpHeaders) => {
                    res.writeHead(status, headers);
                },
                waitChunk: (chunk: Buffer) => {
                    res.write(chunk);
                    if (captureChunk) captureChunk(chunk);
                }
            }).then(r => {
                res.end();
                if (captureChunk) captureChunk(null);
                resolve();
            });
        }));
    }

    /**
     * 访问文件目录
     * @param prefixPath
     * @param dirPath
     * @param isListDir
     * @param indexHtmlNames
     */
    public onFiles(prefixPath: string, dirPath: string, isListDir?: boolean, indexHtmlNames?: Array<string>): void {
        prefixPath = getPurePath(prefixPath);
        isListDir = isListDir || false;
        const defaultHtmlNames = ['index.html', 'index.htm', 'docs/index.html'];

        this.on(['GET', new RegExp(`^${prefixPath}($|/.*$)`)], (match, req, res) => new Promise<HttpRequestEventResultType>((resolve, rejects) => {
            // 路径
            const topSubFullName = decodeURI(getPurePath(match[1]));
            const matcheArray = topSubFullName.match(/^(.*?)(\?|$)/);
            const topSubName = matcheArray ? matcheArray[1] : topSubFullName;
            const topPathName = `${prefixPath}${topSubName}`;
            const topFileName = path.join(dirPath, topSubName);
            try {
                // 判断是否存在
                const topFileState = fs.statSync(topFileName);
                if (topFileState.isDirectory()) {
                    // 探测 index.html | index.htm | ...
                    for (let indexName of (indexHtmlNames || defaultHtmlNames)) {
                        const fileName = path.join(topFileName, indexName);
                        if (fs.existsSync(fileName)) {
                            // 重定向到默认文件
                            redirectLocalPath(res, `${topPathName}/${indexName}`);
                            resolve(); return;
                        }
                    }
                    if (isListDir) {
                        // 返回目录
                        // responseDirectory(res, topFileName, topPathName);
                        responseDirectoryHtml(res, topFileName, topPathName);
                        resolve(); return;
                    } else {
                        // 拒绝访问目录
                        error403(res);
                        resolve(); return;
                    }
                } else {
                    // 返回文件
                    responseFile(req, res, topFileName, topFileState).then(() => {
                        resolve(); return;
                    })
                }
            } catch (err) {
                // 文件/目录 不存在
                error404(res);
                resolve(); return;
            }
        }));
    }

    public onUpload(prefixPath: string, dirPath: string) {
        prefixPath = getPurePath(prefixPath);
        this.on(["GET", prefixPath], async (req, res) => `<html>
            <head>
                <meta charset="utf-8">
                <style>body{color:grey;background-color:#333333;width:80%;margin-left:10%;margin-right:10%;}</style>
            </head>
            <body>
                <h2>Upload</h2>
                <form method="post" action="${prefixPath}" enctype="multipart/form-data">
                    <input type="file" name="file" />
                    <input type="submit" value="Upload" />
                </form>
            </body>
        </html>`);
        this.onApi(["POST", prefixPath], async (match, method, code, headers, query) => {
            for(let item of Object.keys(query)) {
                // console.log(query);
                if (query[item] instanceof Array && query[item][0] instanceof Object) {
                    const info = query[item][0];
                    moveFile(info['path'], `${dirPath}/${info['originalFilename']}`);
                }
            }
            return `
            <head>
                <meta charset="utf-8">
                <style>body{color:grey;background-color:#333333;width:80%;margin-left:10%;margin-right:10%;}</style>
                <meta http-equiv="Refresh" content="3;url=${prefixPath}" />
            </head>
            <body>
                <h2>Done!</h2>
            </body>
            `;
        });
    }

}