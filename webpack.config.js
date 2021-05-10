/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @LastEditTime: 2021-05-10 17:23:28 +0800
 * @FilePath: /ssocket-js/webpack.config.js
 */
// 引入包
const path = require("path")
// 引入build时删除的dist的插件
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
// webpack的锁头配置文件都要写在 module.exports 中
module.exports = {
    mode:"production",
    bail: true,
    devtool: 'source-map',
    // 指定入口文件
    entry: {
        Ssocket: "./src/index.ts"
    } ,
    // 指定到打包后的文件目录
    output: {
        path: path.resolve(__dirname, 'build'),
        // 打包后的文件的文件
        filename: "ssocket.min.js",
        // 打包配置后 （打包后不使用箭头函数）
        environment: {
            arrowFunction: true // 兼容IE11一下
        },
        library: 'Ssocket',
        libraryTarget: 'umd',
        // libraryExport: 'default',
        umdNamedDefine: true,
        publicPath: '/',
    },
    // 指定webpack打包时使用的模块
    module: {
        // 指定打包后的规则
        rules: [
            {
                // test 指定生效的文件
                test: /\.ts$/,
                // 使用 ts-loader 编译所有的 .ts的文件
                use: [
                    // 配置babel
                    {
                        // 指定加载器
                        loader: "babel-loader",
                        options: {
                            // transpileOnly: true,
                            // 设置预定义的运行环境
                            presets: [
                                [
                                    // 指定环境的插件
                                    "@babel/preset-env",
                                    // 配置信息
                                    {
                                        // 要兼容的浏览器版本
                                        targets: {
                                            "chrome": "58",
                                            "ie": "11"
                                        },
                                        // 指定corejs的版本
                                        // "corejs": "3",
                                        // // 使用corejs的方式： usage=>按需加载
                                        // "useBuiltIns": "usage"
                                    }
                                ]
                            ]
                        }
                    },
                    'ts-loader'
                ],
                // 要排除的文件
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new TsconfigPathsPlugin({ configFile: "./tsconfig.json" })
    ],
    // 设置可引用的模块
    resolve: {
        extensions: ['.ts', '.js']
    }
}