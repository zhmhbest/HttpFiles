import { HttpBaseApp } from '../src/lib/http/server/base';

const app = new HttpBaseApp();

app.on([['GET', 'POST'], '/hello'], async (req, res) => {
    return "Hello";
});

app.listen();