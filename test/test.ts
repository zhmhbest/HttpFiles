import * as child_process from 'child_process';

console.log(process.env.ComSpec);
console.log(process.env);

const r = child_process.execSync('php E:/tmp/HelloPHP/index.php', {
    cwd: 'E:/tmp/HelloPHP'
});
console.log(r.toString());
