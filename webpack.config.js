'use strict';

const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        library: { type: 'commonjs2' },
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            parallel: true,
            extractComments: false,
            terserOptions: {
                ecma: 2021,
                keep_classnames: false,
                mangle: true,
                module: true,
                format: {
                    comments: false
                }
            }
        })],
    },

    devtool: 'source-map',
    externals: {
        vscode: "commonjs vscode"
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [{
            test: /\.ts$/,
            exclude: /node_modules/,
            use: [{
                loader: 'ts-loader',
            }]
        }]
    },
};

module.exports = config;
