import { HttpApp } from './lib/http';
import { readJSON } from './lib/file';

interface AppConfig {
    host: string,
    port: number,
    on: Array<{dir: string,  prefix: string,}>
}

const config = readJSON("./config.json") as AppConfig;
const app = new HttpApp(config.port, config.host);
// app.onMapping("/maven2", "https://repo1.maven.org/maven2");
for (const it of config.on) {
    app.onFiles(it.prefix, it.dir, true);
}
app.listen();