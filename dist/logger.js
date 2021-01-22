"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 日志打印
 * @LastEditTime: 2021-01-21 11:15:30 +0800
 * @FilePath: \ssocket-js\src\logger.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var debug_1 = __importDefault(require("debug"));
function date_format() {
    var time = new Date();
    return time.getFullYear() + "-" + (time.getMonth() + 1) + "-" + time.getDate() + " " + time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds() + " " + time.getMilliseconds();
}
function default_1(name) {
    return function (n) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        debug_1.default("ssocket:" + name).extend(n)("[%s]: %o", date_format(), args);
    };
}
exports.default = default_1;
