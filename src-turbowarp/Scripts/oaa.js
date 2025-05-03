class ObjectArrayExtension {
    constructor(runtime) {
        this.runtime = runtime;
        this.arrays = {};
        this.objects = {};
        this.initTranslations();
    }

    hasOwn = (obj, property) => Object.prototype.hasOwnProperty.call(obj, property);
    makeLabel = (text) => ({ blockType: "label", text });

    initTranslations() {
        this.translations = {
            en: {
                blockNames: {
                    createArray: "create Array [name]",
                    sortArrayReg: "sort Array [name] by regex [reg]",
                    getArrayItem: "item [index] of Array [name]",
                    deleteArrayItem: "delete item [x] of Array [name]",
                    deleteFirstLast: "delete [position] of Array [name]",
                    deleteArray: "delete Array [name]",
                    setArray: "set Array [name] to [arrayStr]",
                    insertToArray: "insert [y] before item [x] of Array [name]",
                    appendToArray: "append [x] to end of Array [name]",
                    getArrayInfo: "get [infoType] of Array [name]",
                    splitArray: "split Array [name] as text with [x]",
                    initArray: "init Array [name] with length [len], default [def]",
                    createObject: "create Object [name]",
                    getObjectKeys: "keys of Object [name]",
                    getObjectLength: "length of Object [name]",
                    getObjectValue: "value of [key] in Object [name]",
                    setObjectValue: "set [key] of Object [name] to [value]",
                    deleteObjectKey: "delete [key] of Object [name]",
                    mergeObjects: "merge Object [name1] and [name2] into [target]",
                    getObjectInfo: "get [infoType] of Object [name]",
                    deleteObject: "delete Object [name]",
                    setObjectFromStr: "set Object [name] to [objString]"
                },
                menus: {
                    position: [{ text: "first", value: "first" }, { text: "last", value: "last" }],
                    arrayInfo: [{ text: "length", value: "length" }, { text: "max", value: "max" }, { text: "min", value: "min" }, { text: "string", value: "string" }],
                    objectInfo: [{ text: "length", value: "length" }, { text: "keys", value: "keys" }, { text: "string", value: "string" }]
                },
                info: {
                    extName: "Array & Object",
                    labelArray: "Array",
                    labelObject: "Object",
                }
            },
            zh: {
                blockNames: {
                    createArray: "创建数组[name]",
                    sortArrayReg: "按正则[reg]排序数组[name]",
                    getArrayItem: "数组[name]的第[index]项",
                    deleteArrayItem: "删除数组[name]的第[x]项",
                    deleteFirstLast: "删除数组[name]的[position]项",
                    deleteArray: "删除数组[name]",
                    setArray: "设置数组[name]为[arrayStr]",
                    insertToArray: "在数组[name]的第[x]项前插入[y]",
                    appendToArray: "将[x]追加到数组[name]末尾",
                    getArrayInfo: "获取数组[name]的[infoType]",
                    splitArray: "以[x]分割数组[name]为文本",
                    initArray: "初始化数组[name]长度为[len], 默认值[def]",
                    createObject: "创建对象[name]",
                    getObjectKeys: "对象[name]的所有键名",
                    getObjectLength: "对象[name]的长度",
                    getObjectValue: "对象[name]的属性[key]的值",
                    setObjectValue: "设置对象[name]的属性[key]为[value]",
                    deleteObjectKey: "删除对象[name]的属性[key]",
                    mergeObjects: "合并对象[name1]和[name2]到[target]",
                    getObjectInfo: "获取对象[name]的[infoType]",
                    deleteObject: "删除对象[name]",
                    setObjectFromStr: "设置对象[name]为[objString]"
                },
                menus: {
                    position: [{ text: "首项", value: "first" }, { text: "末项", value: "last" }],
                    arrayInfo: [{ text: "长度", value: "length" }, { text: "最大项", value: "max" }, { text: "最小项", value: "min" }, { text: "字符串形式", value: "string" }],
                    objectInfo: [{ text: "长度", value: "length" }, { text: "键名列表", value: "keys" }, { text: "字符串形式", value: "string" }]
                },
                info: {
                    extName: "数组与对象",
                    labelArray: "数组",
                    labelObject: "对象",
                }
            }
        };
        this.currentLang = Scratch.Translate?.getLanguage() || 'zh';
    }

    getTranslatedBlockText(key) {
        return this.translations[this.currentLang].blockNames[key];
    }

    getMenuItems(menuKey) {
        return this.translations[this.currentLang].menus[menuKey];
    }

    getextInfo(from, key) {
        try {
            return this.translations[this.currentLang][from][key];
        } catch {
            return null;
        }
    }

    getInfo() {
        return {
            id: "objectArray",
            name: this.getextInfo("info", "extName"),
            blocks: [
                this.makeLabel(this.getextInfo("info", "labelArray")),
                { opcode: "createArray", blockType: "command", text: this.getTranslatedBlockText("createArray"), arguments: { name: { type: "string", defaultValue: "arr1" } } },
                { opcode: "sortArrayReg", blockType: "command", text: this.getTranslatedBlockText("sortArrayReg"), arguments: { name: { type: "string", defaultValue: "arr1" }, reg: { type: "string", defaultValue: "\\d+" } } },
                { opcode: "getArrayItem", blockType: "reporter", text: this.getTranslatedBlockText("getArrayItem"), arguments: { name: { type: "string", defaultValue: "arr1" }, index: { type: "number", defaultValue: 1 } } },
                { opcode: "deleteArrayItem", blockType: "command", text: this.getTranslatedBlockText("deleteArrayItem"), arguments: { name: { type: "string", defaultValue: "arr1" }, x: { type: "number", defaultValue: 1 } } },
                { opcode: "deleteFirstLast", blockType: "command", text: this.getTranslatedBlockText("deleteFirstLast"), arguments: { name: { type: "string", defaultValue: "arr1" }, position: { type: "string", menu: "positionMenu", defaultValue: "first" } } },
                { opcode: "deleteArray", blockType: "command", text: this.getTranslatedBlockText("deleteArray"), arguments: { name: { type: "string", defaultValue: "arr1" } } },
                { opcode: "setArray", blockType: "command", text: this.getTranslatedBlockText("setArray"), arguments: { name: { type: "string", defaultValue: "arr1" }, arrayStr: { type: "string", defaultValue: "[1,2,3]" } } },
                { opcode: "insertToArray", blockType: "command", text: this.getTranslatedBlockText("insertToArray"), arguments: { name: { type: "string", defaultValue: "arr1" }, x: { type: "number", defaultValue: 1 }, y: { type: "string", defaultValue: "newItem" } } },
                { opcode: "appendToArray", blockType: "command", text: this.getTranslatedBlockText("appendToArray"), arguments: { name: { type: "string", defaultValue: "arr1" }, x: { type: "string", defaultValue: "newItem" } } },
                { opcode: "getArrayInfo", blockType: "reporter", text: this.getTranslatedBlockText("getArrayInfo"), arguments: { name: { type: "string", defaultValue: "arr1" }, infoType: { type: "string", menu: "arrayInfoMenu", defaultValue: "length" } } },
                { opcode: "splitArray", blockType: "reporter", text: this.getTranslatedBlockText("splitArray"), arguments: { name: { type: "string", defaultValue: "arr1" }, x: { type: "string", defaultValue: "," } } },
                { opcode: "initArray", blockType: "command", text: this.getTranslatedBlockText("initArray"), arguments: { name: { type: "string", defaultValue: "arr1" }, len: { type: "number", defaultValue: 5 }, def: { type: "string", defaultValue: "null" } } },

                this.makeLabel(this.getextInfo("info", "labelObject")),
                { opcode: "createObject", blockType: "command", text: this.getTranslatedBlockText("createObject"), arguments: { name: { type: "string", defaultValue: "obj1" } } },
                { opcode: "getObjectKeys", blockType: "reporter", text: this.getTranslatedBlockText("getObjectKeys"), arguments: { name: { type: "string", defaultValue: "obj1" } } },
                { opcode: "getObjectLength", blockType: "reporter", text: this.getTranslatedBlockText("getObjectLength"), arguments: { name: { type: "string", defaultValue: "obj1" } } },
                { opcode: "getObjectValue", blockType: "reporter", text: this.getTranslatedBlockText("getObjectValue"), arguments: { name: { type: "string", defaultValue: "obj1" }, key: { type: "string", defaultValue: "key" } } },
                { opcode: "setObjectValue", blockType: "command", text: this.getTranslatedBlockText("setObjectValue"), arguments: { name: { type: "string", defaultValue: "obj1" }, key: { type: "string", defaultValue: "key" }, value: { type: "string", defaultValue: "value" } } },
                { opcode: "deleteObjectKey", blockType: "command", text: this.getTranslatedBlockText("deleteObjectKey"), arguments: { name: { type: "string", defaultValue: "obj1" }, key: { type: "string", defaultValue: "key" } } },
                { opcode: "mergeObjects", blockType: "command", text: this.getTranslatedBlockText("mergeObjects"), arguments: { name1: { type: "string", defaultValue: "obj1" }, name2: { type: "string", defaultValue: "obj2" }, target: { type: "string", defaultValue: "mergedObj" } } },
                { opcode: "getObjectInfo", blockType: "reporter", text: this.getTranslatedBlockText("getObjectInfo"), arguments: { name: { type: "string", defaultValue: "obj1" }, infoType: { type: "string", menu: "objectInfoMenu", defaultValue: "length" } } },
                { opcode: "deleteObject", blockType: "command", text: this.getTranslatedBlockText("deleteObject"), arguments: { name: { type: "string", defaultValue: "obj1" } } },
                { opcode: "setObjectFromStr", blockType: "command", text: this.getTranslatedBlockText("setObjectFromStr"), arguments: { name: { type: "string", defaultValue: "obj1" }, objString: { type: "string", defaultValue: "{}" } } }
            ],
            menus: {
                positionMenu: { acceptReporters: true, items: this.getMenuItems("position") },
                arrayInfoMenu: { acceptReporters: true, items: this.getMenuItems("arrayInfo") },
                objectInfoMenu: { acceptReporters: true, items: this.getMenuItems("objectInfo") }
            }
        };
    }

    createArray(args) { this.arrays[args.name] = []; }
    sortArrayReg(args) { const arr = this.arrays[args.name]; if (!arr) return; const regex = new RegExp(args.reg); arr.sort((a, b) => String(a).match(regex)?.[0].localeCompare(String(b).match(regex)?.[0] || '')); }
    getArrayItem(args) { return this.arrays[args.name]?.[args.index - 1] ?? null; }
    deleteArrayItem(args) { const arr = this.arrays[args.name]; if (arr) arr.splice(args.x - 1, 1); }
    deleteFirstLast(args) { const arr = this.arrays[args.name]; if (arr) args.position === "first" ? arr.shift() : arr.pop(); }
    deleteArray(args) { delete this.arrays[args.name]; }
    setArray(args) { try { this.arrays[args.name] = JSON.parse(args.arrayStr); } catch { this.arrays[args.name] = null; } }
    insertToArray(args) { const arr = this.arrays[args.name]; if (arr) arr.splice(args.x - 1, 0, args.y); }
    appendToArray(args) { const arr = this.arrays[args.name]; if (arr) arr.push(args.x); }
    getArrayInfo(args) { const arr = this.arrays[args.name]; if (!arr) return null; const numericArr = arr.filter(Number.isFinite); return { length: arr.length, max: numericArr.length ? Math.max(...numericArr) : null, min: numericArr.length ? Math.min(...numericArr) : null, string: JSON.stringify(arr) }[args.infoType]; }
    splitArray(args) { return this.arrays[args.name]?.join(args.x) ?? null; }
    initArray(args) { this.arrays[args.name] = Array(args.len).fill(args.def); }

    createObject(args) { this.objects[args.name] = {}; }
    getObjectKeys(args) { return this.objects[args.name] ? JSON.stringify(Object.keys(this.objects[args.name])) : null; }
    getObjectLength(args) { return this.objects[args.name] ? Object.keys(this.objects[args.name]).length : null; }
    getObjectValue(args) { return this.objects[args.name]?.[args.key] ?? null; }
    setObjectValue(args) { const obj = this.objects[args.name]; if (obj) obj[args.key] = args.value; }
    deleteObjectKey(args) { const obj = this.objects[args.name]; if (obj) delete obj[args.key]; }
    mergeObjects(args) { this.objects[args.target] = { ...this.objects[args.name1] || {}, ...this.objects[args.name2] || {} }; }
    getObjectInfo(args) { const obj = this.objects[args.name]; if (!obj) return null; return { length: Object.keys(obj).length, keys: JSON.stringify(Object.keys(obj)), string: JSON.stringify(obj) }[args.infoType]; }
    deleteObject(args) { delete this.objects[args.name]; }
    setObjectFromStr(args) { try { this.objects[args.name] = JSON.parse(args.objString); } catch { this.objects[args.name] = null; } }
}

((Scratch) => {
    const extensionInstance = new ObjectArrayExtension(Scratch.vm.runtime);
    Scratch.extensions.register(extensionInstance);
})(Scratch);