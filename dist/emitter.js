"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 事件管理对象
 * @LastEditTime: 2021-01-22 13:08:12 +0800
 * @FilePath: \ssocket-js\src\emitter.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
var Emitter = /** @class */ (function () {
    function Emitter() {
        /**
         * 事件列表
         */
        this._callbacks = {};
    }
    /**
     * 绑定一个事件
     * @param event
     * @param fn
     */
    Emitter.prototype.on = function (event, fn) {
        (this._callbacks[event] = this._callbacks[event] || []).push(fn);
        return this;
    };
    /**
     * 删除所有的事件
     */
    Emitter.prototype.removeAllListeners = function () {
        this._callbacks = {};
        return this;
    };
    /**
     * 删除一个事件，或者一组事件函数
     * @param event
     * @param fn
     */
    Emitter.prototype.off = function (event, fn) {
        var callbacks = this._callbacks[event];
        if (!callbacks)
            return this;
        if (!fn) {
            delete this._callbacks[event];
            return this;
        }
        var cb;
        for (var i = 0; i < callbacks.length; i++) {
            cb = callbacks[i];
            if (cb === fn || cb.fn === fn) {
                callbacks.splice(i, 1);
                break;
            }
        }
        return this;
    };
    /**
     * 绑定一个一次性的事件，该事件在触发一次后自动删除
     * @param event
     * @param fn
     */
    Emitter.prototype.once = function (event, fn) {
        var self = this;
        function on() {
            self.off(event);
            fn.apply(this, arguments);
        }
        on.fn = fn;
        this.on(event, on);
        return this;
    };
    /**
     * 触发一次事件
     * @param event
     * @param args
     */
    Emitter.prototype.emit = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var callbacks = this._callbacks[event];
        if (callbacks) {
            callbacks = callbacks.slice(0);
            for (var i = 0, len = callbacks.length; i < len; ++i) {
                callbacks[i].apply(this, args);
            }
        }
        return this;
    };
    return Emitter;
}());
exports.default = Emitter;
