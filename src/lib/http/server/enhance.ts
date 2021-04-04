import { IncomingHttpHeaders, ServerResponse } from "http";
import { request } from "../request";
import { errorMessage, getPurePath, getRequestQuery, HttpBaseApp, HttpComposedPathIdentity, HttpMethodType, HttpRequestEventResultType } from "./base";

export type HttpRequestApiEvent = (
    match: RegExpMatchArray,
    method: HttpMethodType,
    status: number,
    headers: IncomingHttpHeaders,
    query: NodeJS.Dict<any>
) => Promise<HttpRequestEventResultType>;

export interface HttpFileRange {
    start: number,
    end: number,
    size: number
}

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


}