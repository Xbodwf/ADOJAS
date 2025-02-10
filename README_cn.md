# ADOJAS
[English Version](README.md)
[如何游玩(英/中)](HOWTOPLAY_ALL.md)
## 简介
一个轻量的ADOFAI谱面播放器.

## 建议的IDE设置
[Node.js](https://nodejs.org/zh-cn)
[Visual Studio Code](https://code.visualstudio.com/)
[Rust](https://www.rust-lang.org/)
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) 
[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
[Turbowarp](https://turbowarp.org/desktop)

## 必要的准备工作
在开始之前，你需要

### 一个包管理器(npm,yarn,pnpm) (建议 pnpm)
```sh
npm install pnpm -g
```

### 一个良好的网络环境

## 开始

### 克隆项目并调试
1.克隆并安装依赖
```sh
git clone https://github.com/flutas-web/ADOJAS.git
cd ADOJAS
pnpm install
```

2.调试
```sh
pnpm tauri android init
### ↑Init ↓Debug
pnpm tauri android dev
```

### 构建发行版
```
$ pnpm tauri android build
```



