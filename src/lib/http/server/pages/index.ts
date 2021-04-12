import * as fs from "fs";
import * as path from "path";
import * as ejs from "ejs";
import * as child_process from 'child_process';
import { IncomingMessage, ServerResponse } from "http";
import { formatFileSize, getPureExtensionName } from "../../../file";
import { ExtPrismMap, getPrism } from "./prism";
import { responseFileStream } from "../base";
import { error403, error404, error500 } from "../base";
// https://ejs.bootcss.com/#docs


const responseHtml = (res: ServerResponse, html: string | Buffer) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.write(html);
    res.end();
};
const responseEJS = (res: ServerResponse, ejsName: string, options?: ejs.Data) => {
    const currentDirectory = "./lib/http/server/pages";
    const templatePath = `${currentDirectory}/${ejsName}`;
    const template = fs.readFileSync(templatePath).toString('utf-8');
    responseHtml(res, ejs.render(template, {filename: templatePath, ...options}));
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
                    size: '',
                    ctime: '',
                    mtime: '',
                });
            } else {
                listFiles.push({
                    name,
                    fileName,
                    pathName,
                    size: formatFileSize(fileStat.size),
                    ctime: formatDate(fileStat.ctime, 'yyyy-MM-dd HH:mm:ss'),
                    mtime: formatDate(fileStat.mtime, 'yyyy-MM-dd HH:mm:ss'),
                });
            }
        } catch (err) { continue; }
    }
    // console.log(listFiles);
    responseEJS(res, "listDirectory.ejs", {
        topFileName,
        topPathName,
        listFiles
    });
};

export const responseFile = (req: IncomingMessage, res: ServerResponse, fileName: string, fileStat: fs.Stats) => new Promise<void>((resolve, rejects) => {
    const extName = getPureExtensionName(fileName);
    const UserAgent = req.headers['user-agent'];
    // console.log(UserAgent, UserAgent?.indexOf('Chrome/'));
    if(UserAgent && UserAgent.indexOf('Chrome/') >= 0) {
        // 来自浏览器访问
        const prismInfo = getPrism(extName);
        if (prismInfo) {
            // CodeView
            const [sourceNames, languageName] = prismInfo;
            const text = fs.readFileSync(fileName, { encoding: 'utf8' }).toString();
            responseEJS(res, "codeView.ejs", {
                text,
                languageName,
                sourceNames
            });
            resolve(); return;
        } else if ('md' === extName) {
            // Markdown
            const text = fs.readFileSync(fileName, { encoding: 'utf8' }).toString();
            const testLanguageNames = text.match(/(?<=(\r\n|\n|\r)```).+(?=\r\n|\n|\r)/g);
            const sourceNames = [];
            if (testLanguageNames) {
                const languageNames = new Set<string>(Object.values(testLanguageNames));
                for (let lang of languageNames) {
                    if (ExtPrismMap.has(lang)) {
                        sourceNames.push(ExtPrismMap.get(lang));
                    }
                }
            }
            responseEJS(res, "mdView.ejs", {
                text,
                sourceNames
            });
            resolve(); return;
        }
    }
    // 默认响应方式
    responseFileStream(req, res, fileName, extName, fileStat).then(() => resolve());
    // responseHtml(res, child_process.execSync(`php "${fileName}"`, { cwd: path.dirname(fileName) }));
});

export const responseUploadFileHtml = (res: ServerResponse, actionPath: string) => {
    responseEJS(res, "uploadFile.ejs", {
        actionPath
    });
};