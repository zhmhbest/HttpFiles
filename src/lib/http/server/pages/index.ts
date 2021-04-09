import * as fs from "fs";
import * as path from "path";
import * as ejs from "ejs";
import * as child_process from 'child_process';
import { IncomingMessage, ServerResponse } from "http";
import { formatFileSize, getPureExtensionName } from "../../../file";
import { getPrism } from "./prism";
import { responseFileStream } from "../base";
import { error403, error404, error500 } from "./error";


const responseHtml = (res: ServerResponse, html: string | Buffer) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.write(html);
    res.end();
};


const formatDate = (date: Date, fmt: string) => {
    const ss = new Map([
        [/(M+)/, date.getMonth() + 1],
        [/(d+)/, date.getDate()],
        [/(H+)/, date.getHours()],
        [/(h+)/, date.getHours() % 12],
        [/(m+)/, date.getMinutes()],
        [/(s+)/, date.getSeconds()],
        [/(q+)/, Math.floor((date.getMonth() + 3) / 3)],
        [/(S)/, date.getMilliseconds()],
    ]);
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, date.getFullYear().toString().substr(4 - RegExp.$1.length));
    }
    ss.forEach((val, key) => {
        if (key.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (1 == RegExp.$1.length) ? val.toString() : ((`00${val}`).substr(val.toString().length)));
        }
    });
    return fmt;
}

export const responseDirectoryHtml = (res: ServerResponse, topFileName: string, topPathName: string) => {
    const template = fs.readFileSync("./lib/http/server/pages/listDirectory.ejs").toString('utf-8');
    const listFiles = [];
    for (let name of fs.readdirSync(topFileName)) {
        try {
            if (name.startsWith('$') || name.startsWith('.')) continue;
            const fileName = path.join(topFileName, name);
            const pathName = `${topPathName}/${name}`;
            const fileStat = fs.statSync(fileName);
            if (fileStat.isDirectory()) {
                listFiles.push({
                    name,
                    fileName,
                    pathName,
                    icon: '<svg style="color: Goldenrod;" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path><path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"></path></svg>',
                    size: '',
                    ctime: '',
                    mtime: '',
                });
            } else {
                listFiles.push({
                    name,
                    fileName,
                    pathName,
                    icon: '<svg style="color: LightBlue;" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path></svg>',
                    size: formatFileSize(fileStat.size),
                    ctime: formatDate(fileStat.ctime, 'yyyy-MM-dd HH:mm:ss'),
                    mtime: formatDate(fileStat.mtime, 'yyyy-MM-dd HH:mm:ss'),
                });
            }
        } catch (err) { continue; }
    }
    // console.log(listFiles);
    responseHtml(res, ejs.render(template, {
        topFileName,
        topPathName,
        listFiles
    }))
};

export const responseFile = (req: IncomingMessage, res: ServerResponse, fileName: string, fileStat: fs.Stats) => new Promise<void>((resolve, rejects) => {
    const extName = getPureExtensionName(fileName);
    const prismInfo = getPrism(extName);
    if (undefined === prismInfo) {
        responseFileStream(req, res, fileName, extName, fileStat).then(() => resolve());
        // responseHtml(res, child_process.execSync(`php "${fileName}"`, { cwd: path.dirname(fileName) }));
    } else {
        // CodeView
        const [sourceNames, languageName] = prismInfo;
        const template = fs.readFileSync("./lib/http/server/pages/codeView.ejs").toString('utf-8');
        const text = fs.readFileSync(fileName, { encoding: 'utf8' }).toString();
        responseHtml(res, ejs.render(template, {
            text,
            languageName,
            sourceNames
        }))
        resolve();
    }
});
