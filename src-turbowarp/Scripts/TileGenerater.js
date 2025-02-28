(function (ext) {

    const vm = ext.vm;
    const hasOwn = (obj, property) =>
        Object.prototype.hasOwnProperty.call(obj, property);

    const makeLabel = (text) => ({
        blockType: "label",
        text: text,
    });

    class TileGenerater {
        constructor() {
            console.log("Inited.")
        }
        getInfo() {
            return {
                id: 'TileGenerater',
                name: 'Tile_generater',
                color1: '#00c3ff',
                blocks: [
                    makeLabel("轨道生成器"),
                    {
                        opcode: 'generateTrack',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '以 [type] 作为类型生成颜色为[color]的 [angle]° 轨道',
                        arguments: {
                            type: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: 'Standard',
                                menu: "trackStyle",
                            },
                            color: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '#debb7bff'
                            },
                            angle: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: '180'
                            }
                        }
                    }
                ],
                menus: {
                    trackStyle: {
                        acceptReporters: true,
                        items: [
                            { text: "正式", value: 'Standard' },
                            { text: "霓虹", value: 'Neon' },
                            { text: "霓虹灯", value: 'NeonLight' },
                            { text: "基础", value: 'Basic' },
                            { text: "宝石", value: 'Gems' },
                            { text: "极简", value: 'Minimal' }
                        ],
                    }
                }
            }
        }
        generateTrack(p) {
            let { angle, color, trackType } = p;
            let type = trackType;
            let Tangle = Math.min(180, Math.max(0, Number(angle) || 0));
            color = (color || "#debb7bff").replace(/^#?/, "#");
            type = String(type).trim() || "Standard";

            // 颜色解析
            let hex = color.length >= 7 ? color.substr(0, 7) : "#debb7b";
            let alpha = color.length === 9 ? parseInt(color.substr(7, 2), 16) / 255 : 1;

            // 样式配置
            let fill, stroke;
            switch (type) {
                case "Standard":
                case "Basic":
                    fill = hex; stroke = "#000000"; break;
                case "Minimal":
                    fill = stroke = hex; break;
                case "Neon":
                    fill = "#000000"; stroke = hex; break;
                case "NeonLight":
                    const [h, s, l] = hexToHSL(hex.substr(1));
                    fill = HSLToHex(h, s, Math.min(100, l + 8));
                    stroke = hex; break;
                case "Gems":
                    const size = 80;
                    const points = Array.from({ length: 6 }, (_, i) => {
                        const rad = (i * 60 - 30) * Math.PI / 180;
                        return `${100 + size * Math.cos(rad)},${100 + size * Math.sin(rad)}`;
                    });
                    return `<svg viewBox="0 0 200 200">
                    <path d="M${points.join("L")}Z" fill="${hex}" stroke="#000" stroke-width="2"/>
                </svg>`;
                default:
                    fill = hex; stroke = "#000000";
            }

            // 动态半径计算
            const radius = 100 * Math.cos((Tangle / 2) * Math.PI / 180);

            // SVG生成
            return `<svg viewBox="0 0 200 200">
            <rect width="200" height="200" fill="none"/>
            <g transform="rotate(${Tangle / 2} 100 100)">
                <rect x="30" y="30" width="140" height="140" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            </g>
            <g transform="rotate(${-Tangle / 2} 100 100)">
                <rect x="30" y="30" width="140" height="140" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
            </g>
            <circle cx="100" cy="100" r="${Math.max(10, radius)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        </svg>`;
        }
    }
    ext.extensions.register(new TileGenerater());
})(Scratch);