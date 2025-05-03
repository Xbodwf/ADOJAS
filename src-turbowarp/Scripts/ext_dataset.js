class ext_Dataset {
    constructor(runtime) {
        'use strict';

        if (!Scratch.extensions.unsandboxed) {
            throw new Error('This extension must run unsandboxed');
        }

        this.runtime = runtime;
        this.datasets = {};  // { datasetName: { type, content, dataURL } }
        this.mimeMap = {
            'txt': 'text/plain',
            'json': 'application/json',
            'csv': 'text/csv',
            'xml': 'application/xml',
            'bin': 'application/octet-stream'
        };
    }

    getInfo() {
        return {
            id: "datasetX",
            name: "DataSet",
            blocks: [
                // 1. 导入文件作为数据
                {
                    opcode: "importFileAsDataset",
                    blockType: "command",
                    text: "导入[type]文件作为数据[datasetName]",
                    arguments: {
                        type: {
                            type: "string",
                            menu: "dataTypes",
                            defaultValue: "auto"
                        },
                        datasetName: {
                            type: "string",
                            defaultValue: "data1"
                        }
                    }
                },
                // 2. 导入URL/dataURL作为数据
                {
                    opcode: "importURLAsDataset",
                    blockType: "command",
                    text: "根据[url]作为数据[datasetName]，类型为[type]",
                    arguments: {
                        url: {
                            type: "string",
                            defaultValue: "data:text/plain;base64,SGVsbG8="
                        },
                        datasetName: {
                            type: "string",
                            defaultValue: "data1"
                        },
                        type: {
                            type: "string",
                            menu: "dataTypes",
                            defaultValue: "auto"
                        }
                    }
                },
                // 3. 直接赋值基本类型
                {
                    opcode: "setBasicTypeAsDataset",
                    blockType: "command",
                    text: "根据[valueType]作为数据[datasetName]，值为[value]",
                    arguments: {
                        valueType: {
                            type: "string",
                            menu: "basicTypes",
                            defaultValue: "string"
                        },
                        datasetName: {
                            type: "string",
                            defaultValue: "data1"
                        },
                        value: {
                            type: "string",
                            defaultValue: "示例文本"
                        }
                    }
                },
                // 4. 获取数据信息
                {
                    opcode: "getDatasetInfo",
                    blockType: "reporter",
                    text: "返回数据[datasetName]的[infoType]",
                    arguments: {
                        datasetName: {
                            type: "string",
                            defaultValue: "data1"
                        },
                        infoType: {
                            type: "string",
                            menu: "infoTypes",
                            defaultValue: "type"
                        }
                    }
                },
                // 5. 类型转换
                {
                    opcode: "convertDataset",
                    blockType: "reporter",
                    text: "转换数据[datasetName]为[targetType]",
                    arguments: {
                        datasetName: {
                            type: "string",
                            defaultValue: "data1"
                        },
                        targetType: {
                            type: "string",
                            menu: "targetTypes",
                            defaultValue: "string"
                        }
                    }
                },
                // 6. 获取JSON/Array属性值
                {
                    opcode: "getDatasetProperty",
                    blockType: "reporter",
                    text: "数据[datasetName]的属性[property]的值",
                    arguments: {
                        datasetName: {
                            type: "string",
                            defaultValue: "data1"
                        },
                        property: {
                            type: "string",
                            defaultValue: "key"
                        }
                    }
                }
            ],
            menus: {
                dataTypes: {
                    acceptReporters: true,
                    items: [
                        { text: "自动判断", value: "auto" },
                        { text: "字符串", value: "string" },
                        { text: "整数", value: "integer" },
                        { text: "浮点值", value: "float" },
                        { text: "布尔值", value: "boolean" },
                        { text: "二进制文件", value: "binary" }
                    ]
                },
                basicTypes: {
                    acceptReporters: true,
                    items: [
                        { text: "字符串", value: "string" },
                        { text: "整数", value: "integer" },
                        { text: "浮点值", value: "float" },
                        { text: "布尔值", value: "boolean" }
                    ]
                },
                infoTypes: {
                    acceptReporters: true,
                    items: [
                        { text: "类型", value: "type" },
                        { text: "文本内容", value: "text" },
                        { text: "dataURL", value: "dataURL" },
                        { text: "base64", value: "base64" },
                        { text: "blob", value: "blob" }
                    ]
                },
                targetTypes: {
                    acceptReporters: true,
                    items: [
                        { text: "字符串", value: "string" },
                        { text: "整数", value: "integer" },
                        { text: "浮点值", value: "float" },
                        { text: "布尔值", value: "boolean" },
                        { text: "JSON", value: "json" },
                        { text: "Array", value: "array" },
                        { text: "xml", value: "xml" },
                        { text: "二进制文件", value: "binary" }
                    ]
                }
            }
        };
    }

    // 1. 导入文件作为数据（核心方法）
    importFileAsDataset(args) {
        return new Promise(resolve => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = this._getMIMEType(args.type);

            input.onchange = async (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const content = event.target.result;
                    const determinedType = this._determineType(file.name, args.type, content);
                    this._storeDataset(args.datasetName, determinedType, content, file);
                    resolve();
                };

                args.type === 'binary' || args.type === 'auto' 
                    ? reader.readAsArrayBuffer(file) 
                    : reader.readAsText(file);
            };

            input.click();
        });
    }

    // 2. 导入URL/dataURL作为数据
    async importURLAsDataset(args) {
        try {
            const response = await fetch(args.url);
            const blob = await response.blob();
            const determinedType = args.type === 'auto' 
                ? this._determineType(args.url, 'auto', blob.type)
                : args.type;

            const reader = new FileReader();
            reader.onload = () => {
                this._storeDataset(args.datasetName, determinedType, reader.result, blob);
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            console.error('URL import failed:', e);
        }
    }

    // 3. 直接赋值基本类型
    setBasicTypeAsDataset(args) {
        let parsedValue;
        switch (args.valueType) {
            case 'integer':
                parsedValue = parseInt(args.value, 10);
                break;
            case 'float':
                parsedValue = parseFloat(args.value);
                break;
            case 'boolean':
                parsedValue = args.value.toLowerCase() === 'true';
                break;
            default:
                parsedValue = args.value;
        }
        this._storeDataset(args.datasetName, args.valueType, parsedValue);
    }

    // 4. 获取数据信息
    getDatasetInfo(args) {
        const dataset = this.datasets[args.datasetName];
        if (!dataset) return "Data not found";

        switch (args.infoType) {
            case 'type': return dataset.type;
            case 'text': return this._toText(dataset);
            case 'dataURL': return dataset.dataURL;
            case 'base64': return dataset.dataURL?.split(',')[1] || '';
            case 'blob': return dataset.blob;
        }
    }

    // 5. 类型转换
    convertDataset(args) {
        const dataset = this.datasets[args.datasetName];
        if (!dataset) return "Failure: Data not found";

        try {
            const result = this._convert(dataset.content, dataset.type, args.targetType);
            return `Success:${JSON.stringify(result)}`;
        } catch (e) {
            return `Failure:${e.message}`;
        }
    }

    // 6. 获取JSON/Array属性值
    getDatasetProperty(args) {
        const dataset = this.datasets[args.datasetName];
        if (!dataset || !['json', 'array'].includes(dataset.type)) {
            return "Invalid: Not JSON/Array";
        }

        try {
            return dataset.content[args.property]?.toString() || "Property not found";
        } catch (e) {
            return `Error:${e.message}`;
        }
    }

    // 私有工具方法（与之前逻辑一致）
    _storeDataset(name, type, content, file) {
        this.datasets[name] = {
            type: type,
            content: content,
            dataURL: file || null,
            blob: file ? URL.createObjectURL(file) : null,
            originalFile: file
        };
    }

    _determineType(filename, specifiedType, content) {
        if (specifiedType !== 'auto') return specifiedType;
        const ext = filename.split('.').pop().toLowerCase();
        if (this.mimeMap[ext]?.includes('json')) return 'json';
        if (this.mimeMap[ext]?.includes('csv')) return 'array';
        if (typeof content === 'string') return 'string';
        if (content instanceof ArrayBuffer) return 'binary';
        return 'unknown';
    }

    _getMIMEType(type) {
        if (type === 'auto') return '*/*';
        const mime = {
            'string': 'text/*',
            'json': 'application/json',
            'binary': 'application/octet-stream'
        }[type];
        return mime || '*/*';
    }

    _toText(dataset) {
        if (dataset.type === 'binary') {
            return new TextDecoder().decode(new Uint8Array(dataset.content));
        }
        return dataset.content.toString();
    }

    _convert(content, fromType, toType) {
        if (fromType === 'string' && toType === 'json') {
            return JSON.parse(content);
        }
        if (fromType === 'json' && toType === 'array') {
            return Array.isArray(content) ? content : Object.values(content);
        }
        if (fromType === 'integer' && toType === 'string') {
            return content.toString();
        }
        throw new Error(`Unsupported conversion: ${fromType} → ${toType}`);
    }
}

// 注册扩展
((x) => {
    const extensionInstance = new ext_Dataset(x.vm.runtime);
    x.extensions.register(extensionInstance);
})(Scratch);    