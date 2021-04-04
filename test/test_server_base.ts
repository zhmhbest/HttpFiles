import { HttpApp } from '../src/lib/http/server/enhance';

const app = new HttpApp();

// app.onApi('/hello', async (m, me, s, h, q) => {
//     return {
//         body: {
//             say: 'hello',
//             method: me,
//             query: q
//         }
//     }
// })
// app.on([['GET', 'POST'], '/hello'], async (req, res) => {
//     return "Hello";
// });
// app.onMapping("/baidu", "https://www.baidu.com");
// app.onMapping("/bing", subPath => `https://cn.bing.com/search?q=${subPath.substr(1)}`);
// app.onMapping("/maven2", subPath => {
//     if(0 === subPath.length || subPath.endsWith('/')) {
//         return `https://repo1.maven.org/maven2${subPath}`;
//     } else {
//         return `https://maven.aliyun.com/repository/central${subPath}`;
//     }
// });

app.listen();