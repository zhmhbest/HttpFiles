import { HttpApp } from './lib/http';
import { readJSON } from './lib/file';

interface AppConfig {
    host: string,
    port: number,
    on: Array<{dir: string,  prefix: string,}>
}

const config = readJSON("./config.json") as AppConfig;
const app = new HttpApp(config.port, config.host);
for (const it of config.on) {
    app.onFiles(it.prefix, it.dir);
}
app.listen();