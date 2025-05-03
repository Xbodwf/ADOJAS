

const OuterLevelLoader = {
    load: function (adofai,audio) {
        ADOJASALC.levelADOFAI = adofai;
        ADOJASALC.levelaudio = audio;
    }
}

class OuterLevelController {
    constructor(sc) {
        'use strict';
        
        this.runtime = sc.vm.runtime;
        this.levelADOFAI = '';
        this.levelaudio = '';
        this._lstlevelADOFAI = '';
        if(!Scratch.extensions.unsandboxed) {
            throw new Error("This extension must run unsandboxed");
        }
    }
    getInfo() {
        return {
            id: "adojas",
            name: "ADOJAS",
            blocks: [
                {
                    opcode: "whengetLeveloutside",
                    blockType: Scratch.BlockType.HAT,
                    text: "当预加载谱面内容更改时",
                    isEdgeActivated: true
                },
                {
                    opcode: "getLevelContent",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "获取预加载谱面内容"
                },
                {
                    opcode: "getLevelAudio",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "获取预加载谱面音频"
                }
            ]
        };
    }

    LevelonChanged() {
        Scratch.vm.runtime.startHats("adojas_whengetLeveloutside")
    }
    getLevelContent(){
        return this.levelADOFAI;
    }
    getLevelAudio(){
        return this.levelaudio;
    }
    whengetLeveloutside() {
        let fs = this._lstlevelADOFAI === this.levelADOFAI;
        this._lstlevelADOFAI = this.levelADOFAI;
        return fs;
    }
}


let ADOJASALC;
((Scratch) => {
    ADOJASALC = new OuterLevelController(Scratch);
    Scratch.extensions.register(ADOJASALC);
})(Scratch);  

const ADOJAS = {
    OuterLevelLoader,
    ADOJASALC
}
