// Turbowarp Extension for File & JSON Operations
class FileJSONExtension {
    constructor(runtime) {
      this.runtime = runtime
      this.f = "" // 存储文件内容
      this.k = [] // 存储分行数组
    }
  
    getInfo() {
      return {
        id: "filejsonops",
        name: "FileImporter",
        blocks: [
          {
            opcode: "readFile",
            blockType: "reporter",
            text: "read file as text",
            arguments: {},
          },
          {
            opcode: "getLines",
            blockType: "reporter",
            text: "get lines from file content",
            arguments: {},
          },
          {
            opcode: "parseJSON",
            blockType: "reporter",
            text: "parse file content as JSON",
            arguments: {},
          },
        ],
      }
    }
  
    // 读取文件内容
    readFile() {
      return new Promise((resolve) => {
        const input = document.createElement("input")
        input.type = "file"
  
        input.onchange = (e) => {
          const file = e.target.files[0]
          const reader = new FileReader()
  
          reader.onload = (event) => {
            this.f = event.target.result
            resolve("File loaded successfully")
          }
  
          reader.readAsText(file)
        }
  
        input.click()
      })
    }
  
    // 获取文件行数组
    getLines() {
      this.k = this.f.split("\n")
      return JSON.stringify(this.k)
    }
  
    // 宽松解析JSON
    parseJSON() {
      try {
        // 预处理文本,增加容错性
        const jsonText = this.f
          // 移除注释
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
  
          // 处理意外的字符串换行
          .replace(/"[^"]*(?:\n)[^"]*"/g, (match) => {
            return match.replace(/\n/g, "\\n")
          })
  
          // 处理数字后面的f后缀
          .replace(/(\d+)f/g, "$1")
  
          // 处理多余的逗号
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/,\s*,/g, ",")
  
          // 处理缺少的逗号
          .replace(/([}\]"])\s*(?=\s*["{[])/g, "$1,")
          .replace(/(\d+)\s+(?=\s*["{[])/g, "$1,")
  
        // 尝试解析JSON
        const parsed = JSON.parse(jsonText)
        return JSON.stringify(parsed, null, 2)
      } catch (e) {
        return `Error parsing JSON: ${e.message}\nProcessed text: ${jsonText}`
      }
    }
  }
  // 注册扩展
  ;((x) => {
    const extensionInstance = new FileJSONExtension(window.vm.runtime)
    x.extensions.register(extensionInstance);
  })(Scratch)
  
  