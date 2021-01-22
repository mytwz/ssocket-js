export default class Emitter {
    /**
     * 事件列表
     */
    private _callbacks;
    /**
     * 绑定一个事件
     * @param event
     * @param fn
     */
    on(event: string, fn: Function): this;
    /**
     * 删除所有的事件
     */
    removeAllListeners(): this;
    /**
     * 删除一个事件，或者一组事件函数
     * @param event
     * @param fn
     */
    off(event: string, fn?: Function): this;
    /**
     * 绑定一个一次性的事件，该事件在触发一次后自动删除
     * @param event
     * @param fn
     */
    once(event: string, fn: Function): this;
    /**
     * 触发一次事件
     * @param event
     * @param args
     */
    emit(event: string, ...args: any): this;
}
