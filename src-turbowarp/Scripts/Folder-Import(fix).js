(function(Scratch) {
    'use strict';
  
    if (!Scratch.extensions.unsandboxed) {
      throw new Error('This extension must run unsandboxed');
    }
  
    const icon = 'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIyMjUuMzU0OCIgaGVpZ2h0PSIyMjUuMzU0OCIgdmlld0JveD0iMCwwLDIyNS4zNTQ4LDIyNS4zNTQ4Ij48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTI3LjMyMjYsLTY3LjMyMjYpIj48ZyBkYXRhLXBhcGVyLWRhdGE9InsmcXVvdDtpc1BhaW50aW5nTGF5ZXImcXVvdDs6dHJ1ZX0iIGZpbGwtcnVsZT0ibm9uemVybyIgc3Ryb2tlPSJub25lIiBzdHJva2UtbGluZWNhcD0iYnV0dCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2UtZGFzaGFycmF5PSIiIHN0cm9rZS1kYXNob2Zmc2V0PSIwIiBzdHlsZT0ibWl4LWJsZW5kLW1vZGU6IG5vcm1hbCI+PHBhdGggZD0iTTEyNy4zMjI2LDE4MGMwLC02Mi4yMzAwMSA1MC40NDczOSwtMTEyLjY3NzQgMTEyLjY3NzQsLTExMi42Nzc0YzYyLjIzMDAxLDAgMTEyLjY3NzQsNTAuNDQ3MzkgMTEyLjY3NzQsMTEyLjY3NzRjMCw2Mi4yMzAwMSAtNTAuNDQ3MzksMTEyLjY3NzQgLTExMi42Nzc0LDExMi42Nzc0Yy02Mi4yMzAwMSwwIC0xMTIuNjc3NCwtNTAuNDQ3MzkgLTExMi42Nzc0LC0xMTIuNjc3NHoiIGZpbGw9IiM0Mjg1ZjQiIHN0cm9rZS13aWR0aD0iMCIvPjxnPjxwYXRoIGQ9Ik0yNDAsMTQwdjgwaDgwdi04MHoiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMCIvPjxwYXRoIGQ9Ik0xNjAsMTQwdjgwaDgwdi04MHoiIGZpbGw9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMCIvPjwvZz48L2c+PC9nPjwvc3ZnPg==';
  
    class ImportFolder {
      constructor() {
        this.folderData = [];
      }
  
      getInfo() {
        return {
          id: 'importfolder',
          name: 'Import-Folder',
          color1: '#4285F4',
          color2: '#2855C1',
          menuIconURI: icon,
          blockIconURI: icon,
          blocks: [
            {
              opcode: 'importFolder',
              blockType: Scratch.BlockType.COMMAND,
              text: 'import folder',
              arguments: {}
            },
            {
              opcode: 'getFolderContents',
              blockType: Scratch.BlockType.REPORTER,
              text: 'folder contents as JSON',
              arguments: {}
            },
            {
              opcode: 'getFileCount',
              blockType: Scratch.BlockType.REPORTER,
              text: 'number of files',
              arguments: {}
            }
          ]
        };
      }
  
      importFolder() {
        return new Promise(resolve => {
          const input = document.createElement('input');
          input.type = 'file';
          input.webkitdirectory = true;
          input.directory = true;
          input.multiple = true;
          
          input.onchange = async (e) => {
            this.folderData = [];
            const files = Array.from(e.target.files);
            
            for (const file of files) {
              try {
                const content = await this.readFileContent(file);
                this.folderData.push({
                  name: file.name,
                  content: content
                });
              } catch (error) {
                console.error(`Error reading file ${file.name}:`, error);
              }
            }
            
            resolve();
          };
          input.click();
        });
      }
  
      readFileContent(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = (event) => {
            resolve(event.target.result);
          };
          
          reader.onerror = (error) => {
            reject(error);
          };
          
          reader.readAsDataURL(file);
        });
      }
  
      getFolderContents() {
        return JSON.stringify(this.folderData);
      }
  
      getFileCount() {
        return this.folderData.length;
      }
    }
  
    Scratch.extensions.register(new ImportFolder());
  })(Scratch);