import { HttpApp } from './lib/http';
import { readJSON } from './lib/file';

interface AppConfig {
    host: string,
    port: number,
    on: Array<{dir: string,  prefix: string,}>
}
const config = readJSON("./config.json") as AppConfig;
const app = new HttpApp(config.port, config.host);
// app.on(/^\/$/, async (match, req, res) => {
//     res.write('Hi!');
//     res.end();
// });
app.onMapping("/baidu", "https://www.baidu.com");
app.onMapping("/bing", subPath => `https://cn.bing.com/search?q=${subPath.substr(1)}`);
app.onMapping("/maven2", subPath => {
    if(0 === subPath.length || subPath.endsWith('/')) {
        return `https://repo1.maven.org/maven2${subPath}`;
    } else {
        return `https://maven.aliyun.com/repository/central${subPath}`;
    }
});
for (const it of config.on) {
    app.onFiles(it.prefix, it.dir, true);
}
app.listen();