import * as Code from "./code";
import Emitter from "./emitter";
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
    protos?: any;
}
/**
 * 客户端主类
 */
export default class Ssocket extends Emitter {
    private url;
    /**客户端ID，这个ID与服务端同步 */
    private id;
    /**配置 */
    private opts;
    /**ping 定时器ID */
    private ping_timeout_id;
    /**重连定时器ID */
    private reconnection_id;
    /**重连次数 */
    private reconnection_count;
    /**客户端连接状态 */
    private status;
    /**原生 Socket 对象 */
    get socket(): WebSocket;
    getid(): string;
    getStatus(): Code.SocketStatus;
    /**
     * 构造一个 Ssocket 连接
     * @param url ws/wss 连接地址
     * @param opts 配置
     */
    constructor(url: string, opts: Options);
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
    request(path: string, data: any, fn?: Function): void;
}
export {};
