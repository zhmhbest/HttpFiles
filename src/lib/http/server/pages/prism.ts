// https://www.bootcdn.cn/prism/
// https://prismjs.com/plugins/
// https://github.com/PrismJS/prism/releases

// const CDN_URL = "https://cdn.bootcdn.net/ajax/libs/prism/1.23.0";
// const CDN_URL = "http://127.0.0.1/static/prism/1.23.0";
// const CDN_URL = "http://192.168.19.90/static/prism/1.23.0";

const ExtPrismMap = new Map<string, undefined | string | [string | Array<string>, string]>(
    [
        // ext [sourceName languageName]
        // ext undefined = ext [undefined ext]
        // ext str       = ext [str str]
        ['md', 'markdown'],
        // Shell
        ['sh', 'bash'],
        ['bat', 'batch'],
        ['cmd', 'batch'],
        // Language
        ['sql', 'sql'],
        ['py', 'python'],
        ['vb', 'visual-basic'],
        ['vbs', 'visual-basic'],
        ['rs', 'rust'],
        ['ts', 'typescript'],
        ['java', 'java'],
        ['go', 'go'],
        ['scala', [['java', 'scala'], 'scala']],
        // C/C++
        ['c', 'c'],
        ['h', 'c'],
        ['cpp', 'cpp'],
        ['cmake', 'cmake'],
        // BNF
        ['l', 'bnf'],
        ['y', 'bnf'],
        ['jison', 'bnf'],
        // Config
        ['csv', undefined],
        ['ini', 'ini'],
        ['yaml', 'yaml'],
        ['toml', 'toml'],
        ['properties', 'properties'],
        // Web
        ['jsp', 'html'],
        ['asp', 'aspnet'],
        ['php', 'php'],
        // Others
        ['tex', 'latex'],
        ['iml', 'html'],

    ]
);

/**
 *
 * @param extname
 * @returns [sourceName, languageName, cdnURL]
 */
export const getPrism = (extname: string): undefined | [undefined | string | Array<string>, string] => {
    if (ExtPrismMap.has(extname)) {
        const item = ExtPrismMap.get(extname);
        if (item instanceof Array) {
            const [sourceNames, languageName] = item;
            return [sourceNames, languageName];
        } else {
            if (undefined === item) {
                return [undefined, extname];
            } else {
                return [item, item];
            }
        }
    }
    return undefined;
}