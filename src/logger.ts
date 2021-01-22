/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 日志打印
 * @LastEditTime: 2021-01-21 11:15:30 +0800
 * @FilePath: \ssocket-js\src\logger.ts
 */



import debug from "debug";

function date_format() {
    var time = new Date();
    return `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()} ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} ${time.getMilliseconds()}`
}

export default function (name: string) {
    return function (n: string, ...args: any) {
        debug("ssocket:" + name).extend(n)("[%s]: %o", date_format(), args);
    }
}

