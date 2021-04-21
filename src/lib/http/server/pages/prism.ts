// https://www.bootcdn.cn/prism/
// https://prismjs.com/plugins/
// https://github.com/PrismJS/prism/releases

// const CDN_URL = "https://cdn.bootcdn.net/ajax/libs/prism/1.23.0";
// const CDN_URL = "http://127.0.0.1/static/prism/1.23.0";
// const CDN_URL = "http://192.168.19.90/static/prism/1.23.0";

const PrismExtMap = new Map<string, undefined | string | [undefined | string | Array<string>, string]>(
    [
        // ext [sourceName languageName]
        // ext undefined = ext [undefined ext]
        // ext str       = ext [str str]
        // ['md', 'markdown'],
        // Shell
        ['sh', 'bash'],
        ['bat', 'batch'],
        ['cmd', 'batch'],
        ['ps1', 'powershell'],
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
        ['inl', 'c'],
        ['cpp', 'cpp'],
        ['cmake', 'cmake'],
        ['cs', 'csharp'],
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
        ['jsp', [['markup-templating', 'java'], 'java']],
        // ['asp', 'aspnet'],
        ['php', [['markup-templating', 'php'], 'php']],
        // Others
        ['tex', 'latex'],
        ['iml', [undefined, 'html']],
        ['csproj', [undefined, 'html']],
    ]
);

const PrismLanguageNames = (() => {
    const dump = new Set<string>();
    for (let item of PrismExtMap.values()) {
        if(item) {
            if (item instanceof Array) {
                dump.add(item[1])
            } else {
                dump.add(item)
            }
        }
    }
    return dump;
})();

export const filterPrismLanguageNames = (languageNames: Array<string> | Set<string>, dumpNames: Array<string>): void => {
    const testDid = new Set<string>();
    for (let lang of languageNames) {
        lang = lang.toLowerCase();
        if (testDid.has(lang)) continue;
        if (PrismExtMap.has(lang)) {
            const languageName = PrismExtMap.get(lang);
            if(languageName) {
                if (languageName instanceof Array) {
                    dumpNames.push(languageName[1])
                } else {
                    dumpNames.push(languageName)
                }
            }
        } else if (PrismLanguageNames.has(lang)) {
            dumpNames.push(lang)
        }
        testDid.add(lang);
    }
    testDid.clear();
}

/**
 *
 * @param extname
 * @returns [sourceName, languageName]
 */
export const getPrism = (extname: string): undefined | [undefined | string | Array<string>, string] => {
    if (PrismExtMap.has(extname)) {
        const item = PrismExtMap.get(extname);
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