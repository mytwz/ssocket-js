/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 用于传输数据的编码解压缩操作
 * @LastEditTime: 2021-01-22 15:28:05 +0800
 * @FilePath: \ssocket-js\src\code.ts
 */

import pako from "pako"
import debug from "./logger";

const logger = debug("code")


/**
 * 字符串转 Uint8Array
 * @param {*} str 
 */
function string2buf(str: string): Uint8Array {
    return new TextEncoder().encode(str);
};


function buf2string(buf: Uint8Array): string {
    return new TextDecoder().decode(buf);
};


/**字段类型 */
enum FieldType {
    /**多层结构 */
    message = "message",
    required = "required",
    optional = "optional",
    /**数组 */
    repeated = "repeated"
}
/**数据类型 */
enum DataType {
    uint8 = "uint8",
    uint16 = "uint16",
    uint32 = "uint32",
    uint64 = "uint64",
    float = "float",
    double = "double",
    string = "string",
    message = "message",
}

type ProtosTags = { [key: number]: string }

type ProtosObj = {
    option: string,
    type: string,
    tag: number
}

type ProtosObjs = {
    [name: string]: ProtosObjs | ProtosTags | ProtosObj
    __messages: ProtosObjs;
    __tags: ProtosTags;
}

type ProtosConfig = { [name: string]: ProtosObjs }

/**
 * 
 */
const ProtosCode = new class Protos {
    private protos: ProtosConfig = {};
    parse(protos_config: { [name: string]: any }): void {
        for (let key in protos_config) {
            this.protos[key] = this.parseObject(protos_config[key]);
        }
        logger("ProtosCode:parse", {protos_config, proto: this.protos})
    }
    parseObject(obj: any): ProtosObjs {
        let proto: ProtosObjs = <ProtosObjs>{};
        let nestProtos: ProtosObjs = <ProtosObjs>{};
        let tags: ProtosTags = {};
        for (let name in obj) {
            let tag = obj[name];
            let params = name.split(/\s+/);
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
    }
    writeTag(buffer: DataView, tag: number, offset: number): number {
        buffer.setUint32(offset++, +tag);
        logger("ProtosCode:writeTag", { tag, offset })
        return offset;
    }
    readTag(buffer: DataView, offset: number): number {
        let tag =  buffer.getUint8(offset++)
        logger("ProtosCode:readTag", { offset: offset-1, tag })
        return tag;
    }
    encode(protos_name: string, data: any): Uint8Array {
        if(this.protos[protos_name] && data){
            var buffer = new DataView(new ArrayBuffer(string2buf(JSON.stringify(data)).byteLength * 2))
            let length = this.write(this.protos[protos_name], data, buffer);
            logger("ProtosCode:encode", { protos_name, data, length })
            return new Uint8Array(buffer.buffer.slice(0, length));
        }
        return string2buf(data ? JSON.stringify(data) : "")
    }
    write(protos: ProtosObjs, data: any, buffer: DataView) {
        let offset = 0;
        if (protos) {
            logger("ProtosCode:write1", { data })
            for (let name in data) {
                if (!!protos[name]) {
                    let proto: ProtosObj = <ProtosObj>protos[name];
                    logger("ProtosCode:write2", { name, data: data[name], proto })
                    switch (proto.option) {
                        case FieldType.required:
                        case FieldType.optional:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            offset = this.writeBody(data[name], proto.type, buffer, offset, protos)
                            break;
                        case FieldType.repeated:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            buffer.setUint32(offset, +data[name].length);
                            offset += 4;
                            for (let i = 0, l = data[name].length; i < l; i++) {
                                offset = this.writeBody(data[name][i], proto.type, buffer, offset, protos)
                            }
                            break;
                    }
                }
            }
        }
        logger("ProtosCode:write3", { offset })

        return offset;
    }
    writeBody(value: number | string | any, type: string, buffer: DataView, offset: number, protos: ProtosObjs) {
        logger("ProtosCode:writeBody", { type, value, offset })
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
                var data = string2buf(value + "")
                buffer.setUint32(offset, +data.byteLength);
                offset += 4;
                // write string
                data.forEach(uint8 => buffer.setUint8(offset++, uint8))
                break;
            default:
                var message = <ProtosObjs >protos.__messages[type];
                if (message) {
                    var tmpBuffer = new DataView(new ArrayBuffer(string2buf(JSON.stringify(value)).byteLength * 2))
                    var length = this.write(message, value, tmpBuffer);
                    buffer.setUint32(offset, +length);
                    offset += 4;
                    new Uint8Array(tmpBuffer.buffer.slice(0, length)).forEach(uint8 => buffer.setUint8(offset++, uint8))
                }
                break;
        }

        return offset;
    }
    decode(protos_name: string, buffer: ArrayBuffer) {
        if(this.protos[protos_name]){
            let data = {};
            this.read(this.protos[protos_name], data, buffer, 0);
            logger("ProtosCode:decode", { data })
            return data;
        }
        return buffer.byteLength ? JSON.parse( buf2string(new Uint8Array(buffer)) || "{}" ) : {};
    }
    read(protos: ProtosObjs, data: { [key: string]: any }, _buffer: ArrayBuffer, offset: number): number {
        logger("ProtosCode:decode1", { offset, data, protos })
        if (!!protos) {
            let buffer = new DataView(_buffer);
            while (offset < buffer.byteLength) {
                let tag = this.readTag(buffer, offset); offset += 1;
                let name = protos.__tags[tag];
                let proto = <ProtosObj>protos[name]
                logger("ProtosCode:decode2", { offset, tag, name, proto })
                switch (proto.option) {
                    case 'optional':
                    case 'required':
                        let body = this.readBody(buffer, proto.type, offset, protos);
                        offset = body.offset;
                        data[name] = body.value;
                        break;
                    case 'repeated':
                        if (!data[name]) { data[name] = []; }
                        let length = buffer.getUint32(offset)
                        offset += 4;
                        for (let i = 0; i < length; i++) {
                            let body = this.readBody(buffer, proto.type, offset, protos);
                            offset = body.offset;
                            data[name].push(body.value);
                        }
                        break;
                }
            }

            return offset;
        }
        return 0;
    }
    readBody(buffer: DataView, type: string, offset: number, protos: ProtosObjs) {
        let value: any = "";
        switch (type) {
            case DataType.uint8:
                value = buffer.getUint8(offset)
                offset += 1;
                break;
            case DataType.uint16:
                value = buffer.getUint16(offset)
                offset += 2;
                break;
            case DataType.uint32:
                value = buffer.getUint32(offset)
                offset += 4;
                break;
            case DataType.float:
                value = buffer.getFloat32(offset)
                offset += 4;
                break;
            case DataType.double:
                value = buffer.getFloat64(offset)
                offset += 8;
                break;
            case DataType.string:
                var length = buffer.getUint32(offset)
                offset += 4;
                value = buf2string(new Uint8Array(buffer.buffer.slice(offset, offset += length)))
                break;
            default:

                var message = <ProtosObjs>protos.__messages[type]
                if (message) {
                    var length = buffer.getUint32(offset)
                    offset += 4;
                    this.read(message, value = {}, buffer.buffer.slice(offset, offset += length), 0);
                }
                break;
        }
        logger("ProtosCode:readBody", { offset, type, value })
        return { value, offset }
    }

}

export enum PackageType {
    /**握手 */
    shakehands = 0,
    /**心跳 */
    heartbeat = 1,
    /**消息 */
    data = 2
}


/**Socket 状态 */
export enum SocketStatus {
    /**打开 */
    OPEN,
    /**正在握手 */
    SHAKING_HANDS,
    /**握手完毕 */
    HANDSHAKE,
    /**连接 */
    CONNECTION,
    /**关闭 */
    CLOSE,
    /**重连 */
    RECONNECTION
}


export interface ShakehandsPackageData {
    id: string;
    ack: SocketStatus;
}

export interface PackageData {
    path: string;
    request_id: number;
    status?: number;
    msg?: string;
    data?: { [key: string]: any; } | number;
    [key: string]: any;
}

export interface Package {
    type: PackageType,
    path?: string;
    request_id?: number;
    status?: number;
    msg?: string;
    data?: { [key: string]: any; } | number;
    [key: string]: any;
}

let isProtos = false;

/**
 * 配置 Protos 文件
 * @param config 
 */
export function parseProtosJson(config: any){ ProtosCode.parse(config); isProtos = true; }

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
 * - | 1B   | 4B         | 4B            | --     | --          | 4B   |
 * - +------+------------+---------------+--------+-------------+------+
 * - 
 * @param type 类型：0握手|1心跳|2数据
 * @param package_data 
 */
export function encode(type: PackageType, package_data?: PackageData | ShakehandsPackageData): Uint8Array {

    let buffer = new DataView(new ArrayBuffer(package_data ? JSON.stringify(package_data).length * 2 : 10));
    let index = 0;
    buffer.setUint8(index, type);               index += 1;
    if(PackageType.data == type){
        let { path = "", request_id = 0, data } = <PackageData>package_data || {};
        let _data: Uint8Array       = ProtosCode.encode(path, data)

        if(_data.length > 128){
            _data               = pako.gzip(_data);
        }

        let _path: Uint8Array = string2buf(path);

        buffer.setUint32(index, request_id);        index += 4;

        buffer.setUint32(index, _path.byteLength);  index += 4;
        _path.forEach(uint8 => buffer.setUint8(index++, uint8));

        buffer.setUint32(index, _data.byteLength);  index += 4;
        _data.forEach(uint8 => buffer.setUint8(index++, uint8));
    }
    else if(type == PackageType.heartbeat){
    
        buffer.setFloat64(index, Date.now());           index += 8;
        
    }
    else if(type == PackageType.shakehands){
        let {  id, ack } = <ShakehandsPackageData>package_data || {};
        let _id: Uint8Array = string2buf(id);
        buffer.setUint32(index, _id.byteLength);  index += 4;
        _id.forEach(uint8 => buffer.setUint8(index++, uint8));

        buffer.setUint8(index, ack);  index += 1;
    }

    return new Uint8Array(buffer.buffer.slice(0, index));
}
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
export function decode(_buffer: Uint8Array): Package | ShakehandsPackageData {
    if(_buffer instanceof ArrayBuffer) {
        let index = 0;
        let buffer          = new DataView(_buffer)
        let type            = buffer.getUint8(index++);

        if(type == PackageType.data){

            let request_id  = buffer.getUint32(index); index += 4;
            let path_length = buffer.getUint32(index); index += 4;
            let path        = buf2string(new Uint8Array(buffer.buffer.slice(index, index += path_length)));
            let status      = buffer.getUint32(index); index += 4;
            let msg_length  = buffer.getUint32(index); index += 4;
            let msg         = buf2string(new Uint8Array(buffer.buffer.slice(index, index += msg_length)));
            let data_length = buffer.getUint32(index); index += 4;
            let data_buffer = data_length ? buffer.buffer.slice(index, index += data_length) : new ArrayBuffer(0);
    
            // 判断是否 GZIP 压缩的数据
            if(data_buffer.byteLength > 2 && new Uint16Array(data_buffer.slice(0, 2))[0] == 0x8b1f){
                data_buffer = pako.ungzip(new Uint8Array(data_buffer));
            }
            
            let data        = ProtosCode.decode(path, data_buffer)
            
            return { type, request_id, path, status, msg, data }
        }
        else if(type == PackageType.heartbeat){
            let data        = buffer.getFloat64(index);
            return { type, data }
        }
        else if(type == PackageType.shakehands){
            let id_length   = buffer.getUint32(index); index += 4;
            let id          = buf2string(new Uint8Array(buffer.buffer.slice(index, index += id_length)));
            let ack         = buffer.getUint8(index); index += 1;

            return { type, id, ack }
        }
    };

    return <Package>{};
}


/**系统状态码：这个状态码会通过事件返回给前端 */
export const StatusCode = { 
    4100:[4100, "client ping timeout"],
    4102:[4102, "server ping timeout"],
    4101:[4101, "connection close"],
    200:[200, "ok"],
}

/**
 * 扩展状态码
 * @param code 
 * @param msg 
 */
export function expandStatusCode(code: number, msg: string){
    (<any>StatusCode)[code] = [ code, msg ];
}

export default StatusCode