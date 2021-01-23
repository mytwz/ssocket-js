"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 用于传输数据的编码解压缩操作
 * @LastEditTime: 2021-01-22 15:28:05 +0800
 * @FilePath: \ssocket-js\src\code.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandStatusCode = exports.StatusCode = exports.decode = exports.encode = exports.parseResponseJson = exports.parseRequestJson = exports.SocketStatus = exports.PackageType = void 0;
var pako_1 = __importDefault(require("pako"));
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("code");
/**
 * 字符串转 Uint8Array
 * @param {*} str
 */
function string2buf(str) {
    return new TextEncoder().encode(str);
}
;
function buf2string(buf) {
    return new TextDecoder().decode(buf);
}
;
/**字段类型 */
var FieldType;
(function (FieldType) {
    /**多层结构 */
    FieldType["message"] = "message";
    FieldType["required"] = "required";
    FieldType["optional"] = "optional";
    /**数组 */
    FieldType["repeated"] = "repeated";
})(FieldType || (FieldType = {}));
/**数据类型 */
var DataType;
(function (DataType) {
    DataType["uint8"] = "uint8";
    DataType["uint16"] = "uint16";
    DataType["uint32"] = "uint32";
    DataType["uint64"] = "uint64";
    DataType["float"] = "float";
    DataType["double"] = "double";
    DataType["string"] = "string";
    DataType["message"] = "message";
})(DataType || (DataType = {}));
/**
 *
 */
var Protos = /** @class */ (function () {
    function Protos() {
        this.protos = {};
    }
    Protos.prototype.parse = function (protos_config) {
        for (var key in protos_config) {
            this.protos[key] = this.parseObject(protos_config[key]);
        }
        logger("ProtosCode:parse", { protos_config: protos_config, proto: this.protos });
    };
    Protos.prototype.parseObject = function (obj) {
        var proto = {};
        var nestProtos = {};
        var tags = {};
        for (var name_1 in obj) {
            var tag = obj[name_1];
            var params = name_1.split(/\s+/);
            switch (params[0]) {
                case FieldType.message:
                    if (params.length !== 2) {
                        continue;
                    }
                    nestProtos[params[1]] = this.parseObject(tag);
                    continue;
                case FieldType.required:
                case FieldType.optional:
                case FieldType.repeated: {
                    // params length should be 3 and tag can't be duplicated
                    if (params.length !== 3 || !!tags[tag]) {
                        continue;
                    }
                    proto[params[2]] = {
                        option: params[0],
                        type: params[1],
                        tag: tag
                    };
                    tags[tag] = params[2];
                }
            }
        }
        proto.__messages = nestProtos;
        proto.__tags = tags;
        return proto;
    };
    Protos.prototype.writeTag = function (buffer, tag, offset) {
        buffer.setUint32(offset++, +tag);
        logger("ProtosCode:writeTag", { tag: tag, offset: offset });
        return offset;
    };
    Protos.prototype.readTag = function (buffer, offset) {
        var tag = buffer.getUint8(offset++);
        logger("ProtosCode:readTag", { offset: offset - 1, tag: tag });
        return tag;
    };
    Protos.prototype.encode = function (protos_name, data) {
        if (this.protos[protos_name] && data) {
            var buffer = new DataView(new ArrayBuffer(string2buf(JSON.stringify(data)).byteLength * 2));
            var length_1 = this.write(this.protos[protos_name], data, buffer);
            logger("ProtosCode:encode", { protos_name: protos_name, data: data, length: length_1 });
            return new Uint8Array(buffer.buffer.slice(0, length_1));
        }
        return string2buf(data ? JSON.stringify(data) : "");
    };
    Protos.prototype.write = function (protos, data, buffer) {
        var offset = 0;
        if (protos) {
            logger("ProtosCode:write1", { data: data });
            for (var name_2 in data) {
                if (!!protos[name_2]) {
                    var proto = protos[name_2];
                    logger("ProtosCode:write2", { name: name_2, data: data[name_2], proto: proto });
                    switch (proto.option) {
                        case FieldType.required:
                        case FieldType.optional:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            offset = this.writeBody(data[name_2], proto.type, buffer, offset, protos);
                            break;
                        case FieldType.repeated:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            buffer.setUint32(offset, +data[name_2].length);
                            offset += 4;
                            for (var i = 0, l = data[name_2].length; i < l; i++) {
                                offset = this.writeBody(data[name_2][i], proto.type, buffer, offset, protos);
                            }
                            break;
                    }
                }
            }
        }
        logger("ProtosCode:write3", { offset: offset });
        return offset;
    };
    Protos.prototype.writeBody = function (value, type, buffer, offset, protos) {
        logger("ProtosCode:writeBody", { type: type, value: value, offset: offset });
        switch (type) {
            case DataType.uint8:
                buffer.setUint8(offset, +value);
                offset += 1;
                break;
            case DataType.uint16:
                buffer.setUint16(offset, +value);
                offset += 2;
                break;
            case DataType.uint32:
                buffer.setUint32(offset, +value);
                offset += 4;
                break;
            case DataType.float:
                buffer.setFloat32(offset, +value);
                offset += 4;
                break;
            case DataType.double:
                buffer.setFloat64(offset, +value);
                offset += 8;
                break;
            case DataType.string:
                // Encode length
                var data = string2buf(value + "");
                buffer.setUint32(offset, +data.byteLength);
                offset += 4;
                // write string
                data.forEach(function (uint8) { return buffer.setUint8(offset++, uint8); });
                break;
            default:
                var message = protos.__messages[type];
                if (message) {
                    var tmpBuffer = new DataView(new ArrayBuffer(string2buf(JSON.stringify(value)).byteLength * 2));
                    var length = this.write(message, value, tmpBuffer);
                    buffer.setUint32(offset, +length);
                    offset += 4;
                    new Uint8Array(tmpBuffer.buffer.slice(0, length)).forEach(function (uint8) { return buffer.setUint8(offset++, uint8); });
                }
                break;
        }
        return offset;
    };
    Protos.prototype.decode = function (protos_name, buffer) {
        if (this.protos[protos_name]) {
            var data = {};
            this.read(this.protos[protos_name], data, buffer, 0);
            logger("ProtosCode:decode", { data: data });
            return data;
        }
        return buffer.byteLength ? JSON.parse(buf2string(new Uint8Array(buffer)) || "{}") : {};
    };
    Protos.prototype.read = function (protos, data, _buffer, offset) {
        logger("ProtosCode:decode1", { offset: offset, data: data, protos: protos });
        if (!!protos) {
            var buffer = new DataView(_buffer);
            while (offset < buffer.byteLength) {
                var tag = this.readTag(buffer, offset);
                offset += 1;
                var name_3 = protos.__tags[tag];
                var proto = protos[name_3];
                logger("ProtosCode:decode2", { offset: offset, tag: tag, name: name_3, proto: proto });
                switch (proto.option) {
                    case 'optional':
                    case 'required':
                        var body = this.readBody(buffer, proto.type, offset, protos);
                        offset = body.offset;
                        data[name_3] = body.value;
                        break;
                    case 'repeated':
                        if (!data[name_3]) {
                            data[name_3] = [];
                        }
                        var length_2 = buffer.getUint32(offset);
                        offset += 4;
                        for (var i = 0; i < length_2; i++) {
                            var body_1 = this.readBody(buffer, proto.type, offset, protos);
                            offset = body_1.offset;
                            data[name_3].push(body_1.value);
                        }
                        break;
                }
            }
            return offset;
        }
        return 0;
    };
    Protos.prototype.readBody = function (buffer, type, offset, protos) {
        var value = "";
        switch (type) {
            case DataType.uint8:
                value = buffer.getUint8(offset);
                offset += 1;
                break;
            case DataType.uint16:
                value = buffer.getUint16(offset);
                offset += 2;
                break;
            case DataType.uint32:
                value = buffer.getUint32(offset);
                offset += 4;
                break;
            case DataType.float:
                value = buffer.getFloat32(offset);
                offset += 4;
                break;
            case DataType.double:
                value = buffer.getFloat64(offset);
                offset += 8;
                break;
            case DataType.string:
                var length = buffer.getUint32(offset);
                offset += 4;
                value = buf2string(new Uint8Array(buffer.buffer.slice(offset, offset += length)));
                break;
            default:
                var message = protos.__messages[type];
                if (message) {
                    var length = buffer.getUint32(offset);
                    offset += 4;
                    this.read(message, value = {}, buffer.buffer.slice(offset, offset += length), 0);
                }
                break;
        }
        logger("ProtosCode:readBody", { offset: offset, type: type, value: value });
        return { value: value, offset: offset };
    };
    return Protos;
}());
var RequestProtos = new Protos();
var ResponseProtos = new Protos();
var PackageType;
(function (PackageType) {
    /**握手 */
    PackageType[PackageType["shakehands"] = 0] = "shakehands";
    /**心跳 */
    PackageType[PackageType["heartbeat"] = 1] = "heartbeat";
    /**消息 */
    PackageType[PackageType["data"] = 2] = "data";
})(PackageType = exports.PackageType || (exports.PackageType = {}));
/**Socket 状态 */
var SocketStatus;
(function (SocketStatus) {
    /**打开 */
    SocketStatus[SocketStatus["OPEN"] = 0] = "OPEN";
    /**正在握手 */
    SocketStatus[SocketStatus["SHAKING_HANDS"] = 1] = "SHAKING_HANDS";
    /**握手完毕 */
    SocketStatus[SocketStatus["HANDSHAKE"] = 2] = "HANDSHAKE";
    /**连接 */
    SocketStatus[SocketStatus["CONNECTION"] = 3] = "CONNECTION";
    /**关闭 */
    SocketStatus[SocketStatus["CLOSE"] = 4] = "CLOSE";
    /**重连 */
    SocketStatus[SocketStatus["RECONNECTION"] = 5] = "RECONNECTION";
})(SocketStatus = exports.SocketStatus || (exports.SocketStatus = {}));
/**
 * 配置 Protos 文件
 * @param config
 */
function parseRequestJson(config) { RequestProtos.parse(config); }
exports.parseRequestJson = parseRequestJson;
/**
 * 配置 Protos 文件
 * @param config
 */
function parseResponseJson(config) { ResponseProtos.parse(config); }
exports.parseResponseJson = parseResponseJson;
/**
 * 消息封包
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 0  | body |
 * - +------+------------+---------------------+------+
 * - | type | id length  | id                  | ack  |
 * - +------+------------+---------------------+------+
 * - | 1B   | 4B         | --                  | 1B   |
 * - +------+------------+---------------------+------+
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 1  | body |
 * - +------+----------------------------------+------+
 * - | type | body length                      | time |
 * - +------+----------------------------------+------+
 * - | 1B   | 0B                               | 8B   |
 * - +------+----------------------------------+------+
 * - +------+---------------------------------------------------+------+
 * - | head | This data exists when type == 2                   | body |
 * - +------+------------+---------------+--------+-------------+------+
 * - | type | request_id | path length   | path   | body length | body |
 * - +------+------------+---------------+--------+-------------+------+
 * - | 1B   | 4B         | 4B            | 4B     | --          | 4B   |
 * - +------+------------+---------------+--------+-------------+------+
 * -
 * @param type 类型：0握手|1心跳|2数据
 * @param package_data
 */
function encode(type, package_data) {
    var buffer = new DataView(new ArrayBuffer(package_data ? JSON.stringify(package_data).length * 2 : 10));
    var index = 0;
    buffer.setUint8(index, type);
    index += 1;
    if (PackageType.data == type) {
        var _a = package_data || {}, _b = _a.path, path = _b === void 0 ? "" : _b, _c = _a.request_id, request_id = _c === void 0 ? 0 : _c, data = _a.data;
        var _data = RequestProtos.encode(path, data);
        if (_data.length > 128) {
            _data = pako_1.default.gzip(_data);
        }
        var _path = string2buf(path);
        buffer.setUint32(index, request_id);
        index += 4;
        buffer.setUint32(index, _path.byteLength);
        index += 4;
        _path.forEach(function (uint8) { return buffer.setUint8(index++, uint8); });
        buffer.setUint32(index, _data.byteLength);
        index += 4;
        _data.forEach(function (uint8) { return buffer.setUint8(index++, uint8); });
    }
    else if (type == PackageType.heartbeat) {
        buffer.setFloat64(index, Date.now());
        index += 8;
    }
    else if (type == PackageType.shakehands) {
        var _d = package_data || {}, id = _d.id, ack = _d.ack;
        var _id = string2buf(id);
        buffer.setUint32(index, _id.byteLength);
        index += 4;
        _id.forEach(function (uint8) { return buffer.setUint8(index++, uint8); });
        buffer.setUint8(index, ack);
        index += 1;
    }
    return new Uint8Array(buffer.buffer.slice(0, index));
}
exports.encode = encode;
/**
 * 消息拆包
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 0  | body |
 * - +------+------------+---------------------+------+
 * - | type | id length  | id                  | ack  |
 * - +------+------------+---------------------+------+
 * - | 1B   | 4B         | --                  | 1B   |
 * - +------+------------+---------------------+------+
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 1  | body |
 * - +------+----------------------------------+------+
 * - | type | body length                      | time |
 * - +------+----------------------------------+------+
 * - | 1B   | 0B                               | 8B   |
 * - +------+----------------------------------+------+
 * - +------+-------------------------------------------------------------------------------+------+
 * - | head | This data exists when type == 2                                               | body |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * - | type | request_id | path length   | path   | status | msg length | msg | body length | body |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * - | 1B   | 4B         | 4B            | --     | 4B     | 4B         | --  | 4B          | --   |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * -
 * @param buffer
 */
function decode(_buffer) {
    if (_buffer instanceof ArrayBuffer) {
        var index = 0;
        var buffer = new DataView(_buffer);
        var type = buffer.getUint8(index++);
        if (type == PackageType.data) {
            var request_id = buffer.getUint32(index);
            index += 4;
            var path_length = buffer.getUint32(index);
            index += 4;
            var path = buf2string(new Uint8Array(buffer.buffer.slice(index, index += path_length)));
            var status_1 = buffer.getUint32(index);
            index += 4;
            var msg_length = buffer.getUint32(index);
            index += 4;
            var msg = buf2string(new Uint8Array(buffer.buffer.slice(index, index += msg_length)));
            var data_length = buffer.getUint32(index);
            index += 4;
            var data_buffer = data_length ? buffer.buffer.slice(index, index += data_length) : new ArrayBuffer(0);
            // 判断是否 GZIP 压缩的数据
            if (data_buffer.byteLength > 2 && new Uint16Array(data_buffer.slice(0, 2))[0] == 0x8b1f) {
                data_buffer = pako_1.default.ungzip(new Uint8Array(data_buffer));
            }
            var data = ResponseProtos.decode(path, data_buffer);
            return { type: type, request_id: request_id, path: path, status: status_1, msg: msg, data: data };
        }
        else if (type == PackageType.heartbeat) {
            var data = buffer.getFloat64(index);
            return { type: type, data: data };
        }
        else if (type == PackageType.shakehands) {
            var id_length = buffer.getUint32(index);
            index += 4;
            var id = buf2string(new Uint8Array(buffer.buffer.slice(index, index += id_length)));
            var ack = buffer.getUint8(index);
            index += 1;
            return { type: type, id: id, ack: ack };
        }
    }
    ;
    return {};
}
exports.decode = decode;
/**系统状态码：这个状态码会通过事件返回给前端 */
exports.StatusCode = {
    4100: [4100, "client ping timeout"],
    4102: [4102, "server ping timeout"],
    4101: [4101, "connection close"],
    200: [200, "ok"],
};
/**
 * 扩展状态码
 * @param code
 * @param msg
 */
function expandStatusCode(code, msg) {
    exports.StatusCode[code] = [code, msg];
}
exports.expandStatusCode = expandStatusCode;
exports.default = exports.StatusCode;
