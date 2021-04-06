// https://www.bootcdn.cn/prism/
// https://prismjs.com/plugins/
// https://github.com/PrismJS/prism/releases

const ExtPrismMap = new Map<string, string | undefined>(
    [
        ['md', 'markdown'],
        ['py', 'python'],
        ['bat', 'batch'],
        ['cmd', 'batch'],
        ['sh', 'bash'],
        ['vbs', 'visual-basic'],
        ['h', 'c'],
        ['ts', 'typescript'],
        ['csv', undefined],
        ['iml', 'html']
    ]
);

const ExtCodeSet = new Set<string>([
    'md', 'sh', 'bat', 'cmd', 'py', 'vbs', 'ts', 'h', 'c', 'cmake', 'java', 'sql', 'ini', 'iml', 'yaml', 'csv', 'properties'
]);

/**
 *
 * @param extname
 * @returns [sourceName, languageName, cdnURL]
 */
export const getPrism = (extname: string): undefined | [string | undefined, string, string] => {
    if(ExtCodeSet.has(extname)) {
        const sourceName = ExtPrismMap.has(extname) ? ExtPrismMap.get(extname) : extname;
        const languageName = sourceName || extname;
        return [
            `prism-${sourceName}`,
            `language-${languageName}`,
            // "https://cdn.bootcdn.net/ajax/libs/prism/1.23.0"
            "http://127.0.0.1/static/prism/1.23.0"
        ];
    }
    return undefined;
}