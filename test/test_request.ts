import { request } from '../src/lib/http';
request({
    url: "http://127.0.0.1:8899/test",
    method: 'POST',
    headers: {
        'age': '996'
    },
    body: ['hihi']
}).then(res => {
    console.log(res.toString());
});