class ext_AudioSystem {
    constructor(runtime) {

        'use strict';

        if (!Scratch.extensions.unsandboxed) {
            throw new Error('This extension must run unsandboxed');
        }

        this.runtime = runtime;
        this.audioObjects = {};
        var runTimer = 0;

        runtime.shouldExecuteStopClicked = true;
        runtime.on("BEFORE_EXECUTE", () => {
            runTimer++;
            runtime.shouldExecuteStopClicked = false;
        });
        runtime.on("PROJECT_START", () => {
            runTimer = 0;
        });
        runtime.on("PROJECT_STOP_ALL", () => {
            runTimer = 0;
            if (runtime.shouldExecuteStopClicked)
                queueMicrotask(() =>
                    this.stopAllSounds()
                );
        });
        runtime.on("AFTER_EXECUTE", () => {
            runtime.shouldExecuteStopClicked = true;
        });
        const originalGreenFlag = vm.greenFlag;
        vm.greenFlag = function () {
            runtime.shouldExecuteStopClicked = false;
            originalGreenFlag.call(this);
        };
    }

    getInfo() {
        return {
            id: "audiosystem",
            name: "AudioSystem",
            blocks: [
                {
                    opcode: "playAudioOnce",
                    blockType: "command",
                    text: "一次性播放音频 [DATAURL]",
                    arguments: {
                        DATAURL: {
                            type: "string",
                            defaultValue: ""
                        }
                    }
                },
                {
                    opcode: "createAudioObject",
                    blockType: "command",
                    text: "创建音频对象 [NAME]",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        }
                    }
                },
                {
                    opcode: "createAudioObjectWithDataURL",
                    blockType: "command",
                    text: "创建音频对象 [NAME] 并设置音频 [DATAURL]",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        },
                        DATAURL: {
                            type: "string",
                            defaultValue: ""
                        }
                    }
                },
                {
                    opcode: "setAudioDataURL",
                    blockType: "command",
                    text: "设置音频对象 [NAME] 音频为 [DATAURL]",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        },
                        DATAURL: {
                            type: "string",
                            defaultValue: ""
                        }
                    }
                },
                {
                    opcode: "setAudioProperty",
                    blockType: "command",
                    text: "设置音频对象 [NAME] 的 [PROPERTY] 为 [VALUE]",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        },
                        PROPERTY: {
                            type: "string",
                            menu: "audioProperties",
                            defaultValue: "currentTime"
                        },
                        VALUE: {
                            type: "number",
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: "getAudioProperty",
                    blockType: "reporter",
                    text: "获取音频对象 [NAME] 的 [PROPERTY]",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        },
                        PROPERTY: {
                            type: "string",
                            menu: "audioProperties",
                            defaultValue: "currentTime"
                        }
                    }
                },
                {
                    opcode: "resetAudioObject",
                    blockType: "command",
                    text: "重置音频对象 [NAME] 的所有属性",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        }
                    }
                },
                {
                    opcode: "playAudioOnceWithVolume",
                    blockType: "command",
                    text: "一次性播放音频 [DATAURL], 音量为 [VOLUME]",
                    arguments: {
                        DATAURL: {
                            type: "string",
                            defaultValue: ""
                        },
                        VOLUME: {
                            type: "number",
                            defaultValue: 100
                        }
                    }
                },
                {
                    opcode: "togglePlayPause",
                    blockType: "command",
                    text: "暂停/继续 [NAME] 的播放",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        }
                    }
                },
                {
                    opcode: "pauseAudio",
                    blockType: "command",
                    text: "暂停 [NAME] 的播放",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        }
                    }
                },
                {
                    opcode: "resumeAudio",
                    blockType: "command",
                    text: "继续 [NAME] 的播放",
                    arguments: {
                        NAME: {
                            type: "string",
                            defaultValue: "audioObj"
                        }
                    }
                },
                {
                    opcode: "stopAllSounds",
                    blockType: "command",
                    text: "停止所有声音"
                }
            ],
            menus: {
                audioProperties: {
                    acceptReporters: true,
                    items: [
                        {
                            text: "当前播放位置(秒)",
                            value: "currentTime"
                        },
                        {
                            text: "音高",
                            value: "pitch"
                        },
                        {
                            text: "倍速",
                            value: "playbackRate"
                        },
                        {
                            text: "音量(100%)",
                            value: "volume"
                        },
                        {
                            text: "音频总长度",
                            value: "duration"
                        }
                    ]
                }
            }
        };
    }

    playAudioOnce(args) {
        const audio = new Audio(args.DATAURL);
        audio.play();
        audio.onended = () => {
            audio.remove();
        };
    }

    createAudioObject(args) {
        this.audioObjects[args.NAME] = new Audio();
    }

    createAudioObjectWithDataURL(args) {
        this.audioObjects[args.NAME] = new Audio(args.DATAURL);
    }

    setAudioDataURL(args) {
        if (this.audioObjects[args.NAME]) {
            this.audioObjects[args.NAME].src = args.DATAURL;
        }
    }

    setAudioProperty(args) {
        const audio = this.audioObjects[args.NAME];
        if (audio) {
            switch (args.PROPERTY) {
                case "currentTime":
                    audio.currentTime = args.VALUE;
                    break;
                case "pitch":
                    // 浏览器音频 API 没有直接的 pitch 属性，这里简单处理
                    audio.playbackRate = args.VALUE;
                    break;
                case "playbackRate":
                    audio.playbackRate = args.VALUE;
                    break;
                case "volume":
                    audio.volume = args.VALUE / 100;
                    break;
            }
        }
    }

    getAudioProperty(args) {
        const audio = this.audioObjects[args.NAME];
        if (audio) {
            switch (args.PROPERTY) {
                case "currentTime":
                    return audio.currentTime;
                case "pitch":
                    return audio.playbackRate;
                case "playbackRate":
                    return audio.playbackRate;
                case "volume":
                    return audio.volume * 100;
                case "duration":
                    return audio.duration;
            }
        }
        return null;
    }

    resetAudioObject(args) {
        const audio = this.audioObjects[args.NAME];
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.playbackRate = 1;
            audio.volume = 1;
            audio.src = "";
        }
    }

    playAudioOnceWithVolume(args) {
        const audio = new Audio(args.DATAURL);
        audio.volume = args.VOLUME / 100;
        audio.play();
        audio.onended = () => {
            audio.remove();
        };
    }

    togglePlayPause(args) {
        const audio = this.audioObjects[args.NAME];
        if (audio) {
            if (audio.paused) {
                audio.play();
            } else {
                audio.pause();
            }
        }
    }

    pauseAudio(args) {
        const audio = this.audioObjects[args.NAME];
        if (audio) {
            audio.pause();
        }
    }

    resumeAudio(args) {
        const audio = this.audioObjects[args.NAME];
        if (audio) {
            audio.play();
        }
    }

    stopAllSounds() {
        for (const name in this.audioObjects) {
            const audio = this.audioObjects[name];
            audio.pause();
            audio.currentTime = 0;
        }
    }
}

// 注册扩展
((x) => {
    const extensionInstance = new ext_AudioSystem(window.vm.runtime);
    x.extensions.register(extensionInstance);
})(Scratch);
