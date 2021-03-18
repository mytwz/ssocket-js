"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 客户端程序
 * @LastEditTime: 2021-03-18 16:37:06 +0800
 * @FilePath: /ssocket-js/src/index.ts
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var code_1 = __importStar(require("./code")), Code = code_1;
var emitter_1 = __importDefault(require("./emitter"));
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("swebsocket");
var socket;
var __index__ = 0;
/**
 * 发送握手包
 * @param id 客户端ID
 * @param ack 握手ID
 */
function shakehands(id, ack) {
    if (socket && socket.readyState != WebSocket.OPEN)
        return;
    socket.send(Code.encode(Code.PackageType.shakehands, { id: id, ack: ack }));
    logger(id + ":shakehands", { ack: ack });
}
/**
 * 发送消息
 * @param id 客户端ID
 * @param data JSON 数据包
 */
function send(id, data) {
    if (!data.path)
        return logger(id + ":send", "Cannot have the path field");
    if (socket && socket.readyState != WebSocket.OPEN)
        return;
    socket.send(Code.encode(Code.PackageType.data, data));
    logger(id + ":send", data);
}
module.exports = /** @class */ (function (_super) {
    __extends(Ssocket, _super);
    /**
     * 构造一个 Ssocket 连接
     * @param url ws/wss 连接地址
     * @param opts 配置
     */
    function Ssocket(url, opts) {
        var _this = _super.call(this) || this;
        _this.url = url;
        /**客户端连接状态 */
        _this.status = Code.SocketStatus.CLOSE;
        _this.opts = Object.assign({
            ping_timeout: 1000 * 11,
            ping_time: 1000 * 9,
            reconnection_count: Number.MAX_VALUE,
            reconnection_time: 1000 * 2,
        }, opts);
        _this.id = "";
        _this.ping_timeout_id = 0;
        _this.reconnection_id = 0;
        socket = null;
        _this.reconnection_count = _this.opts.reconnection_count;
        if (_this.opts.protos) {
            if (_this.opts.protos.request)
                Code.parseRequestJson(_this.opts.protos.request);
            if (_this.opts.protos.response)
                Code.parseResponseJson(_this.opts.protos.response);
        }
        logger(_this.id + ":constructor", { opts: opts });
        return _this;
    }
    Object.defineProperty(Ssocket.prototype, "socket", {
        /**原生 Socket 对象 */
        get: function () { return socket; },
        enumerable: false,
        configurable: true
    });
    Ssocket.prototype.getid = function () { return this.id; };
    Ssocket.prototype.getStatus = function () { return this.status; };
    /**
     * 手动发送重连
     */
    Ssocket.prototype.connection = function () {
        var _this = this;
        if (this.status != Code.SocketStatus.CLOSE)
            return;
        socket = new WebSocket(this.url);
        socket.binaryType = "arraybuffer";
        socket.onopen = function (ev) {
            clearTimeout(_this.reconnection_id);
            _this.emit("open", ev);
            _this.status = Code.SocketStatus.OPEN;
            _this.reconnection_count = _this.opts.reconnection_count;
            shakehands(_this.id, Code.SocketStatus.SHAKING_HANDS);
            _this.emit("shakehands", _this.status = Code.SocketStatus.SHAKING_HANDS);
            logger(_this.id + ":open", { status: _this.status });
        };
        socket.onclose = function (_a) {
            var code = _a.code, reason = _a.reason;
            clearTimeout(_this.ping_timeout_id);
            _this.status = Code.SocketStatus.CLOSE;
            socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
            socket = null;
            if (--_this.reconnection_count >= 0) {
                _this.reconnection_id = setTimeout(function () {
                    _this.connection();
                    _this.emit("reconnectioning", _this.opts.reconnection_count - _this.reconnection_count);
                    _this.status = Code.SocketStatus.RECONNECTION;
                    logger(_this.id + ":reconnectioning", { status: _this.status });
                }, _this.opts.reconnection_time);
            }
            _this.emit("close", { code: code, reason: reason });
            logger(_this.id + ":close", { code: code, reason: reason });
        };
        socket.onerror = function (ev) { return _this.emit("error", ev); };
        socket.onmessage = function (ev) {
            var data = Code.decode(ev.data);
            logger(_this.id + ":message", data);
            if (data.type == Code.PackageType.shakehands) {
                if (data.ack == Code.SocketStatus.HANDSHAKE) {
                    if (_this.id == "")
                        _this.id = data.id;
                    shakehands(_this.id, Code.SocketStatus.CONNECTION);
                    _this.emit("shakehands", _this.status = Code.SocketStatus.HANDSHAKE);
                }
                else if (data.ack == Code.SocketStatus.CONNECTION) {
                    _this.status = Code.SocketStatus.CONNECTION;
                    _this.emit("shakehands", _this.status = Code.SocketStatus.CONNECTION);
                    _this.emit(_this.id != data.id ? "reconnection" : "connection");
                    socket.send(Code.encode(Code.PackageType.heartbeat));
                }
            }
            else if (data.type == Code.PackageType.heartbeat) {
                _this.emit("pong", data.data);
                clearTimeout(_this.ping_timeout_id);
                setTimeout(function () {
                    socket.send(Code.encode(Code.PackageType.heartbeat));
                    _this.ping_timeout_id = setTimeout(function (_) { return socket.close(code_1.default[4102][0], code_1.default[4102][1]); }, _this.opts.ping_timeout);
                    _this.emit("ping");
                    logger(_this.id + ":heartbeat");
                }, _this.opts.ping_time);
            }
            else if (data.type == Code.PackageType.data) {
                if (data.request_id)
                    _this.emit(data.request_id, data);
                else
                    _this.emit(data.path, data);
            }
        };
    };
    /**
     * 发起一次消息请求
     * @param path 请求路径
     * @param data 携带数据
     * @param fn 回调函数，非必传
     */
    Ssocket.prototype.request = function (path, data, fn) {
        if (this.status != Code.SocketStatus.CONNECTION)
            return;
        var request_data = { path: path, data: data };
        if (fn) {
            request_data.request_id = __index__++ > 999999 ? (__index__ = 1) : __index__;
            this.once(String(request_data.request_id), fn);
        }
        try {
            send(this.id, request_data);
        }
        catch (error) {
            this.emit.apply(this, __spreadArrays(["close", this.getid()], code_1.default[4101]));
            this.status = Code.SocketStatus.CLOSE;
            logger(this.id + ":send", error);
        }
    };
    return Ssocket;
}(emitter_1.default));
