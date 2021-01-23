/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 客户端程序
 * @LastEditTime: 2021-01-21 11:34:51 +0800
 * @FilePath: \ssocket-js\src\index.ts
 */

import CODE, * as Code from "./code"
import Emitter from "./emitter"
import debug from "./logger";

const logger = debug("swebsocket")

/**
 * 连接配置
 */
interface Options {
    /**ping 超时时间单位：毫秒 */
    ping_timeout: number;
    /**ping 间隔时间：单位毫秒 */
    ping_time: number;
    /**重连次数 */
    reconnection_count: number;
    /**每次重连的间隔：单位毫秒 */
    reconnection_time: number;
    /**protos 压缩配置 */
    protos?: {
        request?: {[key: string]: any};
        response?: {[key: string]: any};
        
    };
}

let socket: WebSocket;
let __index__: number = 0;

/**
 * 发送握手包
 * @param id 客户端ID
 * @param ack 握手ID
 */
function shakehands(id: string, ack: Code.SocketStatus){
    if(socket && socket.readyState != WebSocket.OPEN) return ;
    socket.send(Code.encode(Code.PackageType.shakehands, { id, ack }))
    logger(id + ":shakehands", { ack })
}
/**
 * 发送消息
 * @param id 客户端ID
 * @param data JSON 数据包
 */
function send(id: string, data: Code.PackageData){
    if(!data.path) return logger(id + ":send", "Cannot have the path field")
    if(socket && socket.readyState != WebSocket.OPEN) return ;
    socket.send(Code.encode(Code.PackageType.data, data))
    logger(id + ":send", data)
}

/**
 * 客户端主类
 */
export default class Ssocket extends Emitter {
    /**客户端ID，这个ID与服务端同步 */
    private id: string;
    /**配置 */
    private opts: Options;
    /**ping 定时器ID */
    private ping_timeout_id: NodeJS.Timeout;
    /**重连定时器ID */
    private reconnection_id: NodeJS.Timeout;
    /**重连次数 */
    private reconnection_count: number;
    /**客户端连接状态 */
    private status: Code.SocketStatus = Code.SocketStatus.CLOSE;
    /**原生 Socket 对象 */
    public get socket(): WebSocket { return socket; }
    public getid(): string { return this.id; }
    public getStatus(): Code.SocketStatus { return this.status }

    /**
     * 构造一个 Ssocket 连接
     * @param url ws/wss 连接地址
     * @param opts 配置
     */
    constructor(private url: string, opts: Options){
        super();
        this.opts = Object.assign({
            ping_timeout: 1000 * 11,
            ping_time: 1000 * 9,
            reconnection_count: Number.MAX_VALUE,
            reconnection_time: 1000 * 2,
        }, opts);
        this.id = "";
        this.ping_timeout_id = <NodeJS.Timeout><unknown>0;
        this.reconnection_id = <NodeJS.Timeout><unknown>0;
        socket = <WebSocket><unknown>null;
        this.reconnection_count = this.opts.reconnection_count;
        if(this.opts.protos){
            if(this.opts.protos.request) Code.parseRequestJson(this.opts.protos.request)
            if(this.opts.protos.response) Code.parseResponseJson(this.opts.protos.response)
        }
        this.connection();
        logger(this.id + ":constructor", {opts})
    }
    /**
     * 手动发送重连
     */
    public connection(){
        if(this.status != Code.SocketStatus.CLOSE) return ;
        socket = new WebSocket(this.url);
        socket.binaryType = "arraybuffer";
        socket.onopen = ev => {
            clearTimeout(this.reconnection_id)
            this.emit("open", ev)
            this.status = Code.SocketStatus.OPEN;
            this.reconnection_count = this.opts.reconnection_count;
            shakehands(this.id, Code.SocketStatus.SHAKING_HANDS);
            this.emit("shakehands", this.status = Code.SocketStatus.SHAKING_HANDS)
            logger(this.id + ":open", {status : this.status})
        }
        socket.onclose = ({ code, reason }) => {
            clearTimeout(this.ping_timeout_id);
            this.status = Code.SocketStatus.CLOSE;
            socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
            socket = <WebSocket><unknown>null;
            if(--this.reconnection_count >= 0){
                this.reconnection_id = setTimeout(() => {
                    this.connection();
                    this.emit("reconnectioning", this.opts.reconnection_count - this.reconnection_count)
                    this.status = Code.SocketStatus.RECONNECTION;
                    logger(this.id + ":reconnectioning", {status : this.status})
                }, this.opts.reconnection_time)
            }
            this.emit("close", { code, reason })
            logger(this.id + ":close", {code, reason})
        };
        socket.onerror = ev => this.emit("error", ev)
        socket.onmessage = ev => {
            let data: any = Code.decode(ev.data);
            logger(this.id + ":message", data)
            if( data.type == Code.PackageType.shakehands ){
                if(data.ack == Code.SocketStatus.HANDSHAKE){
                    if(this.id == "") this.id = data.id;
                    shakehands(this.id, Code.SocketStatus.CONNECTION);
                    this.emit("shakehands", this.status = Code.SocketStatus.HANDSHAKE)
                }
                else if(data.ack == Code.SocketStatus.CONNECTION){
                    this.status = Code.SocketStatus.CONNECTION
                    this.emit("shakehands", this.status = Code.SocketStatus.CONNECTION)
                    this.emit(this.id != data.id ? "reconnection" : "connection")
                    socket.send(Code.encode(Code.PackageType.heartbeat))
                }
            }
            else if(data.type == Code.PackageType.heartbeat) {
                this.emit("pong", data.data)
                clearTimeout(this.ping_timeout_id);
                setTimeout(() => {
                    socket.send(Code.encode(Code.PackageType.heartbeat))
                    this.ping_timeout_id = setTimeout(_ => socket.close(<number>CODE[4102][0], <string>CODE[4102][1]), this.opts.ping_timeout)
                    this.emit("ping")
                    logger(this.id + ":heartbeat")
                }, this.opts.ping_time)
            }
            else if(data.type == Code.PackageType.data) {
                if(data.request_id) this.emit(<string>data.request_id, data);
                else this.emit(<string>data.path, data);
            }
        }
    }

    /**
     * 发起一次消息请求
     * @param path 请求路径
     * @param data 携带数据
     * @param fn 回调函数，非必传
     */
    public request(path: string, data: any, fn?: Function){
        if(this.status != Code.SocketStatus.CONNECTION) return;
        let request_data = <Code.PackageData>{ path, data };
        if(fn){
            request_data.request_id = __index__++ > 999999 ? (__index__ = 1) : __index__
            this.once(String(request_data.request_id), fn)
        }
        
        try {
            send(this.id, request_data)
        } catch (error) {
            this.emit("close", this.getid(), ...CODE[4101]);
            this.status = Code.SocketStatus.CLOSE
            logger(this.id + ":send", error)
        }
    }
}

