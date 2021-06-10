const path = require('path');
const root = path.resolve(__dirname);
const CopyWebpackPlugin = require('copy-webpack-plugin');

// package
const packageOptions = require('./package.json');;

// tsconfig
const tsconfigOptions = (() => {
    const JSON5 = require("json5");
    const fs = require("fs");
    const readUTF8Text = (filename) => {
        const BOM = Buffer.from("\uFEFF"); // EF BB BF
        let buffer = fs.readFileSync(filename, { flag: 'r' });
        if (BOM.equals(buffer.slice(0, 3))) {
            // utf-8-sig
            buffer = buffer.slice(3);
        }
        return buffer.toString('utf-8');
    };
    return JSON5.parse(readUTF8Text('./tsconfig.json'))['compilerOptions'];
})();

// webpack
module.exports = {
    mode: 'production', // production | development
    entry: {
        // package.json
        index: packageOptions['main']
    },
    target: 'node',
    output: {
        // tsconfig.json
        path: path.resolve(root, tsconfigOptions['outDir']),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: ['ts-loader'],
                exclude: /node_modules/
            },
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [{
                // tsconfig.json
                from: tsconfigOptions['rootDir'],
                to: './',
                globOptions: {
                    ignore: [
                        "**/*.ts",
                        "**/*.js",
                    ]
                }
            }]
        }),
    ]
}