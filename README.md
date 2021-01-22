![npm version](https://img.shields.io/badge/npm-1.0.0-brightgreen)

## 使用说明

### 建立连接

```javascript
 // <script src="./dist/ssocket.min.js"></script> 浏览器引入方式
const Ssocket = require("ssocket-js");
const client = new Ssocket("ws[wss]://ip[:port]", {
    /**ping 超时时间单位：毫秒 */
    ping_timeout: 1000 * 60,
    /**ping 间隔时间：单位毫秒 */
    ping_time: 1000 * 1,
    /**重连次数 */
    reconnection_count: 60,
    /**每次重连的间隔：单位毫秒 */
    reconnection_time: 1000 * 2,
})
```

### 基础事件监听

```javascript
client.on("close", function(id, code, reason){
    console.log("客户端ID", id)
    console.log("断开代码", code)
    console.log("断开原因", reason)
})
client.on("open", function(){
    console.log("连接打开, 开始握手, 此时还不能发送消息") 
})
client.on("connection", function(){
    console.log("与服务端握手成功， 此时可以开始发送消息")
})
client.on("shakehands", function(status){
    console.log("握手状态", status) 
})
client.on("reconnectioning", function(count){
    console.log("开始重连， 剩余重连次数", count) 
})
client.on("reconnection", function(){
    console.log("重连成功")
})
client.on("pong", function(server_now_time){
    console.log("心跳服务器回应，此时服务器当前时间是", server_now_time)
})
client.on("ping", function(){
    console.log("客户端发送一次心跳包")
})

client.on("test", function(ctx){
    console.log("收到服务端事件响应")
    console.log("返回码", ctx.status)
    console.log("返回描述", ctx.msg)
    console.log("返回数据", ctx.data)
})
```

### 发送消息

```javascript

client.request("test", { id: 123 })
client.request("test", { id: 123 }, function(ctx){
    console.log("收到服务端请求返回", )
    console.log("返回码", ctx.status)
    console.log("返回描述", ctx.msg)
    console.log("返回数据", ctx.data)
})

```



### ProtoBuffer 解压缩配置

```javascript
const client = new Ssocket("ws[wss]://ip[:port]", {
    /**protos 开启压缩并配置：注 当数据量大于 128 字节的时候自动开启 GZIP 压缩  */
    protos: {
        /*request path*/"test":{
            /**
             * [required单字段|repeated重复字段|message自定义结构] [string|uint[8|16|32]|float|double] fieldname: 序号同级唯一
             */
            "required string username": 0,
            "required uint8 age": 1,
            "required uint32 amount": 2,
            "required string avatar": 3,
            "required Data test": 4,
            "message Data": {
                "required string usernmae": 0,
                "repeated uint8 ids": 1,
                "repeated List list": 2,
                "message List": {
                    "required uint32 id": 0,
                },
            },
        }
    }
})
client.request("test", {
    username:"测试账号",
    age:12,
    amount: 30000,
    avatar:"https://12123123.jpg",
    test:{
        usernmae: "测试账号2",
        ids:[1,3,4,5,6,7,4],
        list:[
            {id:123},{id:12},{id:23},{id:2123}
        ]
    }
}, function(ctx){
    console.log("返回状态", ctx.status)// 200
    console.log("返回说明", ctx.msg)// ok
    console.log("返回数据", ctx.data) // { username:"登录成功，欢迎测试账号" }
})
```
