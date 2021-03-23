const path = require('path');
const root = path.resolve(__dirname);
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'production', // production | development
    entry: {
        index: './src/index.ts'
    },
    target: 'node',
    output: {
        path: path.resolve(root, 'out'),
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
                from: 'src/',
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