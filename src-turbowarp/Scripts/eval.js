(function (ext) {

    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('This extension must run unsandboxed');
    }

    const vm = ext.vm;
    const hasOwn = (obj, property) =>
        Object.prototype.hasOwnProperty.call(obj, property);

    const makeLabel = (text) => ({
        blockType: "label",
        text: text,
    });

    class Evalext {
        constructor() {
            console.log("Inited.");
        }
        getInfo() {
            return {
                id: 'Eval',
                name: 'eval',
                color1: '#00c3ff',
                blocks: [
                    makeLabel("Eval"),
                    {
                        opcode: 'evalt',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '执行 [code]',
                        arguments: {
                            code: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '(function(e){return(e)})(1)',
                            }
                        }
                    },
                    {
                        opcode: 'evaltr',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '执行并返回结果 [code]',
                        arguments: {
                            code: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '(function(e){return(e)})(1)',
                            }
                        }
                    }
                ]
            }
        }
        evalt(args) {
            let t = null;
            let err = null;
            try {
                t = eval(args.code);
            } catch(e) {
                err = e;
            }
            return JSON.stringify({
                result: t,
                error: err?.message || null
            });
        }

        evaltr(args) {
            return this.evalt(args)
        }
    }
    ext.extensions.register(new Evalext());
})(Scratch);