# fe-proxy

一个用于重定向 URL 并允许 CORS 的工具，使本地开发体验变得更加简单。

## 主要功能

- [x] 支持基于正则表达式和HTTP请求方法匹配请求
- [x] 支持跨域
- [x] 支持更改请求的URL
- [x] 支持导入/导出规则配置
- [x] 支持调整分组及规则顺序

## node

```shell
nvm alias default v16.20.2
npm install -g yarn
yarn install
# manifest v2 打包
yarn run build
# manifest v3 打包
yarn run build-v3
```

## 安装

略

## License

MIT
