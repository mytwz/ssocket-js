/// <reference types="node" />
import * as Code from "./code";
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
        request?: {
            [key: string]: any;
        };
        response?: {
            [key: string]: any;
        };
    };
}
declare const _default: {
    new (url: string, opts: Options): {
        /**客户端ID，这个ID与服务端同步 */
        id: string;
        /**配置 */
        opts: Options;
        /**ping 定时器ID */
        ping_timeout_id: NodeJS.Timeout;
        /**重连定时器ID */
        reconnection_id: NodeJS.Timeout;
        /**重连次数 */
        reconnection_count: number;
        /**客户端连接状态 */
        status: Code.SocketStatus;
        /**原生 Socket 对象 */
        readonly socket: WebSocket;
        getid(): string;
        getStatus(): Code.SocketStatus;
        url: string;
        /**
         * 手动发送重连
         */
        connection(): void;
        /**
         * 发起一次消息请求
         * @param path 请求路径
         * @param data 携带数据
         * @param fn 回调函数，非必传
         */
        request(path: string, data: any, fn?: Function | undefined): void;
        _callbacks: {
            [event: string]: Function[];
        };
        on(event: string, fn: Function): any;
        removeAllListeners(): any;
        off(event: string, fn?: Function | undefined): any;
        once(event: string, fn: Function): any;
        emit(event: string, ...args: any): any;
    };
};
/**
 * 客户端主类
 */
export = _default;
