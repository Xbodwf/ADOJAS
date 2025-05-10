class VersionManagerExtension {
    constructor(runtime) {
        this.runtime = runtime;
        this.currentLang = Scratch.Translate?.getLanguage() || 'zh-cn';
        this.currentVersion = "1.0.0";        // 当前版本号
        this.versionFormat = "x.x.x_tip";     // 版本格式模板
        this.versionKey = "com.flutas.adojas";// 默认版本键路径
        this.defaultServer = null;            // 默认更新服务器
        this.servers = new Map();             // 服务器存储：{name: {url, options, responseType, versionKey}}
    }

    // 多语言翻译表（覆盖所有积木和提示）
    getTranslations() {
        return {
            'zh-cn': {
                extensionName: "版本管理",
                blocks: {
                    setVersion: "设定当前版本为[version]",
                    getVersion: "当前版本",
                    setFormat: "设定版本格式为[type]",
                    setServerResponseType: "设定更新服务器[name]的响应格式为[type]",
                    setVersionKey: "设定版本键为[key]",
                    setDefaultServer: "设定默认更新服务器为[name]",
                    addServer: "添加更新服务器[name] URL[URL] 选项[Options]",
                    updateServerAttr: "设定更新服务器[name]的[ATTR]为[value]",
                    deleteServer: "删除更新服务器[name]",
                    listServers: "列出所有更新服务器",
                    serverCount: "更新服务器数量",
                    checkUpdate: "检查更新服务器[name]的更新"
                },
                tooltips: {
                    setVersion: "设置当前项目的版本号（如1.2.3_beta）",
                    getVersion: "获取当前设定的版本号",
                    setFormat: "设置版本号格式（如x.x.x_tip）",
                    setServerResponseType: "设置服务器返回数据的格式（JSON/XML）",
                    setVersionKey: "设置版本号在响应数据中的定位路径（如com.flutas.adojas）",
                    setDefaultServer: "设置用于检查更新的默认服务器",
                    addServer: "添加一个更新服务器（Options为JSON格式）",
                    updateServerAttr: "修改现有服务器的URL、选项或响应格式",
                    deleteServer: "删除指定更新服务器",
                    listServers: "返回所有服务器的JSON数组（包含URL、选项等信息）",
                    serverCount: "返回已添加的更新服务器数量",
                    checkUpdate: "向指定服务器发送无缓存请求，解析并对比版本号"
                },
                menus: {
                    serverAttr: ["URL", "选项", "响应格式"],
                    responseType: ["JSON", "XML"]
                }
            },
            en: {
                extensionName: "Version Manager",
                blocks: {
                    setVersion: "Set current version to [version]",
                    getVersion: "Current version",
                    setFormat: "Set version format to [type]",
                    setServerResponseType: "Set response type of server [name] to [type]",
                    setVersionKey: "Set version key to [key]",
                    setDefaultServer: "Set default update server to [name]",
                    addServer: "Add update server [name] URL[URL] options[Options]",
                    updateServerAttr: "Set [ATTR] of server [name] to [value]",
                    deleteServer: "Delete update server [name]",
                    listServers: "List all update servers",
                    serverCount: "Number of update servers",
                    checkUpdate: "Check updates from server [name]"
                },
                tooltips: {
                    setVersion: "Set current project version (e.g., 1.2.3_beta)",
                    getVersion: "Get currently set version number",
                    setFormat: "Set version format (e.g., x.x.x_tip)",
                    setServerResponseType: "Set server response format (JSON/XML)",
                    setVersionKey: "Set path to version number in response (e.g., com.flutas.adojas)",
                    setDefaultServer: "Set default server for update checks",
                    addServer: "Add an update server (Options in JSON format)",
                    updateServerAttr: "Modify existing server's URL, options, or response type",
                    deleteServer: "Remove specified update server",
                    listServers: "Return JSON array of all servers (with URL, options, etc.)",
                    serverCount: "Return count of added update servers",
                    checkUpdate: "Send no-cache request to server, parse and compare version numbers"
                },
                menus: {
                    serverAttr: ["URL", "Options", "Response Type"],
                    responseType: ["JSON", "XML"]
                }
            }
        };
    }

    // 翻译工具方法
    _(key) {
        const translations = this.getTranslations()[this.currentLang];
        return translations[key];
    }

    // 扩展信息定义（积木块配置）
    getInfo() {
        return {
            id: "versionManager",
            name: this._("extensionName"),
            color1: "#4A90E2",    // 主题色（蓝色系）
            color2: "#64B5F6",
            blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZD0iTTEyIDNINlYxaDZ2MnpNNSA2SDN2MWgyVjZ6TTggNkg2djFoMlY2ek0xMSA2SDl2MWgyVjZ6TTQgOUE1IDUgMCAwIDEgOSA0IDUgNSAwIDAgMSAxNCA5IDUgNSAwIDAgMSA5IDE0IDUgNSAwIDAgMSA0IDl6bTQuNSA1LjVMNyAxMS41djNINlY5aDJ2MmwzLjUtMy41IDMuNSAzLjV2LTNoLTF2M3oiIGZpbGw9IiM0QTkwRTIiLz48L3N2Zz4=",
            menus: {
                // 服务器属性菜单（用于更新服务器属性积木）
                SERVER_ATTR: {
                    items: this._("menus").serverAttr.map((text, idx) => ({
                        text: text,
                        value: ["url", "options", "responseType"][idx]  // 对应实际属性名
                    }))
                },
                // 响应类型菜单（JSON/XML）
                RESPONSE_TYPE: {
                    items: this._("menus").responseType.map(text => ({
                        text: text,
                        value: text.toLowerCase()  // 存储为小写（json/xml）
                    }))
                }
            },
            blocks: [
                /* 版本管理模块 */
                {
                    opcode: "setCurrentVersion",
                    blockType: "command",
                    text: this._("blocks").setVersion,
                    tooltip: this._("tooltips").setVersion,
                    arguments: {
                        version: { type: "string", defaultValue: "1.0.0" }
                    }
                },
                {
                    opcode: "getCurrentVersion",
                    blockType: "reporter",
                    text: this._("blocks").getVersion,
                    tooltip: this._("tooltips").getVersion
                },
                {
                    opcode: "setVersionFormat",
                    blockType: "command",
                    text: this._("blocks").setFormat,
                    tooltip: this._("tooltips").setFormat,
                    arguments: {
                        type: { type: "string", defaultValue: "x.x.x_tip" }
                    }
                },

                /* 服务器配置模块 */
                {
                    opcode: "setServerResponseType",
                    blockType: "command",
                    text: this._("blocks").setServerResponseType,
                    tooltip: this._("tooltips").setServerResponseType,
                    arguments: {
                        name: { type: "string", defaultValue: "main" },
                        type: { type: "string", menu: "RESPONSE_TYPE" }
                    }
                },
                {
                    opcode: "setVersionKey",
                    blockType: "command",
                    text: this._("blocks").setVersionKey,
                    tooltip: this._("tooltips").setVersionKey,
                    arguments: {
                        key: { type: "string", defaultValue: "com.flutas.adojas" }
                    }
                },
                {
                    opcode: "setDefaultServer",
                    blockType: "command",
                    text: this._("blocks").setDefaultServer,
                    tooltip: this._("tooltips").setDefaultServer,
                    arguments: {
                        name: { type: "string", defaultValue: "main" }
                    }
                },
                {
                    opcode: "addUpdateServer",
                    blockType: "command",
                    text: this._("blocks").addServer,
                    tooltip: this._("tooltips").addServer,
                    arguments: {
                        name: { type: "string", defaultValue: "main" },
                        URL: { type: "string", defaultValue: "https://api.example.com/updates" },
                        Options: { type: "string", defaultValue: '{"method":"GET"}' }  // 默认GET请求
                    }
                },
                {
                    opcode: "updateServerAttribute",
                    blockType: "command",
                    text: this._("blocks").updateServerAttr,
                    tooltip: this._("tooltips").updateServerAttr,
                    arguments: {
                        name: { type: "string", defaultValue: "main" },
                        ATTR: { type: "string", menu: "SERVER_ATTR" },  // 关联菜单
                        value: { type: "string", defaultValue: "https://new.api.com/updates" }
                    }
                },
                {
                    opcode: "deleteUpdateServer",
                    blockType: "command",
                    text: this._("blocks").deleteServer,
                    tooltip: this._("tooltips").deleteServer,
                    arguments: {
                        name: { type: "string", defaultValue: "main" }
                    }
                },
                {
                    opcode: "listAllServers",
                    blockType: "reporter",
                    text: this._("blocks").listServers,
                    tooltip: this._("tooltips").listServers
                },
                {
                    opcode: "getServerCount",
                    blockType: "reporter",
                    text: this._("blocks").serverCount,
                    tooltip: this._("tooltips").serverCount
                },

                /* 核心更新检查模块 */
                {
                    opcode: "checkForUpdates",
                    blockType: "reporter",
                    text: this._("blocks").checkUpdate,
                    tooltip: this._("tooltips").checkUpdate,
                    arguments: {
                        name: { type: "string", defaultValue: "main" }  // 默认使用main服务器
                    },
                    isAsync: true  // 标记为异步积木（需等待网络请求）
                }
            ]
        };
    }

    /******************** 版本管理方法 ********************/
    setCurrentVersion(args) {
        this.currentVersion = args.version.trim();
    }

    getCurrentVersion() {
        return this.currentVersion;
    }

    setVersionFormat(args) {
        this.versionFormat = args.type.trim();
    }

    /******************** 服务器配置方法 ********************/
    setVersionKey(args) {
        this.versionKey = args.key.trim();
    }

    setDefaultServer(args) {
        this.defaultServer = args.name.trim();
    }

    addUpdateServer(args) {
        try {
            const options = JSON.parse(args.Options);
            this.servers.set(args.name.trim(), {
                url: args.URL.trim(),
                options: { ...options, cache: "no-cache" },  // 强制无缓存
                responseType: "json",                        // 默认JSON格式
                versionKey: this.versionKey                  // 使用全局版本键
            });
        } catch (e) {
            console.error("添加服务器失败：无效的JSON选项", e);
        }
    }

    setServerResponseType(args) {
        const server = this.servers.get(args.name.trim());
        if (server) server.responseType = args.type.toLowerCase();
    }

    updateServerAttribute(args) {
        const server = this.servers.get(args.name.trim());
        if (!server) return;

        switch (args.ATTR) {
            case "url":
                server.url = args.value.trim();
                break;
            case "options":
                try {
                    server.options = { ...JSON.parse(args.value), cache: "no-cache" };
                } catch (e) {
                    console.error("更新选项失败：无效的JSON", e);
                }
                break;
            case "responseType":
                server.responseType = args.value.toLowerCase();
                break;
        }
    }

    deleteUpdateServer(args) {
        this.servers.delete(args.name.trim());
    }

    listAllServers() {
        return JSON.stringify(Array.from(this.servers.entries()).map(([name, data]) => ({
            name,
            url: data.url,
            options: data.options,
            responseType: data.responseType,
            versionKey: data.versionKey
        })));
    }

    getServerCount() {
        return this.servers.size;
    }

    /******************** 核心更新检查逻辑 ********************/
    async checkForUpdates(args) {
        const serverName = args.name.trim() || this.defaultServer;
        const server = this.servers.get(serverName);
        if (!server) return "服务器未找到";

        try {
            // 1. 发送网络请求（强制无缓存）
            const response = await fetch(server.url, server.options);
            if (!response.ok) throw new Error(`HTTP错误：${response.status}`);
            const rawData = await response.text();

            // 2. 根据响应类型解析数据
            let parsedVersion = null;
            switch (server.responseType) {
                case "json":
                    parsedVersion = this._parseJsonVersion(rawData, server.versionKey);
                    break;
                case "xml":
                    parsedVersion = this._parseXmlVersion(rawData, server.versionKey);
                    break;
                default:
                    throw new Error(`未知的响应格式：${server.responseType}`);
            }

            // 3. 版本对比（忽略tip部分）
            if (!parsedVersion) return this.currentVersion;
            const hasNewVersion = this._compareVersions(this.currentVersion, parsedVersion);
            return hasNewVersion ? parsedVersion : this.currentVersion;

        } catch (e) {
            console.error("更新检查失败：", e);
            return this.currentVersion;  // 出错时返回当前版本
        }
    }

    // JSON版本解析（根据版本键路径提取）
    _parseJsonVersion(rawJson, keyPath) {
        const json = JSON.parse(rawJson);
        return keyPath.split('.').reduce((obj, key) => {
            return obj && obj.hasOwnProperty(key) ? obj[key] : null;
        }, json);
    }

    // XML版本解析（简化实现，按节点名逐级查找）
    _parseXmlVersion(rawXml, keyPath) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(rawXml, "text/xml");
        const nodes = keyPath.split('.');
        let currentNode = xmlDoc.documentElement;

        for (const nodeName of nodes) {
            const nextNode = currentNode.querySelector(nodeName);
            if (!nextNode) return null;
            currentNode = nextNode;
        }
        return currentNode.textContent.trim();
    }

    // 版本对比（忽略tip，支持任意段数）
    _compareVersions(current, remote) {
        // 提取主版本（去除_tip及之后的内容）
        const currentMain = current.split('_')[0].split('.').map(Number);
        const remoteMain = remote.split('_')[0].split('.').map(Number);

        // 逐段对比数字部分
        for (let i = 0; i < Math.max(currentMain.length, remoteMain.length); i++) {
            const curr = currentMain[i] || 0;  // 短版本补0
            const remot = remoteMain[i] || 0;
            if (remot > curr) return true;     // 远程版本更新
            if (remot < curr) return false;
        }
        return false;  // 版本相同或更旧
    }
}

// 注册扩展到Turbowarp环境
((Scratch) => {
    const extension = new VersionManagerExtension(Scratch.vm.runtime);
    Scratch.extensions.register(extension);
})(Scratch);
    