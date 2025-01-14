(function (Scratch) {

    const vm = Scratch.vm;
    const hasOwn = (obj, property) =>
        Object.prototype.hasOwnProperty.call(obj, property);

    const makeLabel = (text) => ({
        blockType: "label",
        text: text,
    });

    class BeatCalc {
        getInfo() {
            return {
                id: 'BeatCalc',
                name: 'Adofai_Beat_Calc',
                color1: '#000000',
                color2: '#000000',
                blocks: [
                    makeLabel("节拍计算器"),
                    {
                        opcode: 'calculateBeats',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'playerTile [pt] swirls[sw] angles[angles] level-enddir [enddir] end-flip [flip] planet-count [pc] offset [x] [y] [l]',
                        arguments: {
                            pt: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            },
                            sw: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "[]"
                            },
                            angles: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: "[]"
                            },
                            enddir: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 90
                            },
                            flip: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            },
                            pc: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 0
                            },
                            x: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '[]'
                            },
                            y: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '[]'
                            },
                            l: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '[]'
                            }
                        }
                    }
                ]
            }
        }

        calculateBeats(t) {
            return new Promise((resolve) => {
                try {
                    const SwirlList = JSON.parse(t.sw).map(f => parseInt(f));
                    const AngleList = JSON.parse(t.angles).map(f => parseFloat(f));
                    const playerTile = parseInt(t.pt);
                    const level_enddir = parseFloat(t.enddir);
                    const end_flip = parseInt(t.flip);
                    const planet_count = parseInt(t.pc);
                    const x = JSON.parse(t.x).map(f => parseFloat(f));
                    const y = JSON.parse(t.y).map(f => parseFloat(f));
                    const l = JSON.parse(t.l).map(f => parseInt(f));
                    console.log({SwirlList, AngleList, playerTile, level_enddir, end_flip, planet_count, x, y, l});
                    resolve(this.calculateBeatsPlus(SwirlList, AngleList, playerTile, level_enddir, end_flip, planet_count, x, y, l));
                } catch (e) {
                    console.error("Error in calculateBeats:", e);
                    resolve(JSON.stringify({}));
                }
            })

        }
        calculateBeatsPlus(SwirlList, angles, playerTile, level_enddir, end_flip, planet_count, ox, oy, ol) {
            let x = 0;
            let y = 0;
            let px = 0;
            let py = 0;
            let pangle = 0;
            let pswirl = 1;
            let k = end_flip;
            let dir = level_enddir;
            let pdir = dir - 90;
            let player_dotonline = 0;
            let i = angles.length;
            for (;i >= 0;) {
                
                if (SwirlList.includes(i + 1)) {
                    k = k*-1;
                }
                if (i == playerTile) {
                    px = x;
                    py = y;
                    pangle = (90 - pdir) % 360 - 90;
                    pswirl = k;
                }
                let key = angles[i - 1] * k - 180;
                pdir -= key;
                dir = (90 - pdir) % 360;
                x -= this.scratchSin(dir);
                y -= this.scratchCos(dir);
                if (i <= playerTile) {
                    player_dotonline = (1 + player_dotonline) % planet_count;
                }
                if (ol.includes(i - 1)) {
                    x -= ox[ol.indexOf(i - 1)];
                    y -= oy[ol.indexOf(i - 1)];
                }
                i--;
            }
            console.log({
                x: x,
                y: y,
                px: px,
                py: py,
                pangle: pangle,
                pswirl: pswirl,
                player_dotonline: player_dotonline
            })
            return JSON.stringify({
                x: x,
                y: y,
                px: px,
                py: py,
                pangle: pangle,
                pswirl: pswirl,
                player_dotonline: player_dotonline
            })
        }

        toRadians(degrees) {
            return degrees * (Math.PI / 180);
        }

        scratchSin(degrees) {
            return Math.sin(this.toRadians(degrees));
        }

        scratchCos(degrees) {
            return Math.cos(this.toRadians(degrees));
        }

    }
    Scratch.extensions.register(new BeatCalc());
})(Scratch)