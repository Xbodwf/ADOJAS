/* 
  SVG/PNG Texture Extension for Scratch
  - Accepts base64 (data URL or pure base64) of SVG/PNG
  - Draws image onto an overlay canvas on top of the stage
  - Provides blocks for loading, drawing, clearing, opacity, rotation, smoothing, visibility

  Notes:
  - Stage coordinate system: center (0,0), width 480, height 360
  - We map stage coords to overlay canvas pixels to render at correct positions
*/

(function (Scratch) {
  'use strict';

  if (!Scratch || !Scratch.vm || !Scratch.vm.renderer || !Scratch.extensions) {
    console.warn('SVG Texture extension: Scratch runtime not found.');
    return;
  }

  class SVGTexture {
    constructor() {
      this._overlay = null;     // canvas element
      this._ctx = null;         // 2D context
      this._visible = true;
      this._opacity = 100;      // 0-100
      this._rotation = 0;       // degrees
      this._smoothing = true;   // imageSmoothingEnabled

      this._img = null;         // HTMLImageElement
      this._imgNaturalWidth = 0;
      this._imgNaturalHeight = 0;

      this._lastCanvasSize = { w: 0, h: 0 };
      this._zIndex = 100;       // overlay z-index over stage

      // Bind resize loop tick
      this._ensureOverlay = this._ensureOverlay.bind(this);
      this._syncCanvasWithStage = this._syncCanvasWithStage.bind(this);
    }

    getInfo() {
      return {
        id: 'svgtexture',
        name: 'SVG Texture',
        color1: '#4bb3fd',
        color2: '#2e8de6',
        color3: '#115db0',
        blocks: [
          {
            opcode: 'loadTexture',
            blockType: Scratch.BlockType.COMMAND,
            text: '加载纹理 类型 [TYPE] 数据 [DATA] 并等待',
            arguments: {
              TYPE: {
                type: Scratch.ArgumentType.STRING,
                menu: 'typeMenu',
                defaultValue: 'auto'
              },
              DATA: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'data:image/png;base64,iVBORw0...'
              }
            }
          },
          {
            opcode: 'draw',
            blockType: Scratch.BlockType.COMMAND,
            text: '绘制纹理 到 x [X] y [Y] 宽 [W] 高 [H] 锚点 [ANCHOR]',
            arguments: {
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              ANCHOR: {
                type: Scratch.ArgumentType.STRING,
                menu: 'anchorMenu',
                defaultValue: 'center'
              }
            }
          },
          {
            opcode: 'clear',
            blockType: Scratch.BlockType.COMMAND,
            text: '清空画布'
          },
          '---',
          {
            opcode: 'setOpacity',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置透明度为 [OP]',
            arguments: {
              OP: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          {
            opcode: 'setRotation',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置旋转角度为 [DEG] 度',
            arguments: {
              DEG: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'setSmoothing',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置平滑插值为 [ON]',
            arguments: {
              ON: { type: Scratch.ArgumentType.BOOLEAN, defaultValue: true }
            }
          },
          {
            opcode: 'setVisible',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置可见为 [ON]',
            arguments: {
              ON: { type: Scratch.ArgumentType.BOOLEAN, defaultValue: true }
            }
          },
          {
            opcode: 'setZIndex',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置层级为 [Z]',
            arguments: {
              Z: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          '---',
          {
            opcode: 'hasTexture',
            blockType: Scratch.BlockType.BOOLEAN,
            text: '已加载纹理？'
          },
          {
            opcode: 'textureSizeW',
            blockType: Scratch.BlockType.REPORTER,
            text: '纹理宽度'
          },
          {
            opcode: 'textureSizeH',
            blockType: Scratch.BlockType.REPORTER,
            text: '纹理高度'
          }
        ],
        menus: {
          typeMenu: {
            acceptReporters: true,
            items: [
              { text: 'auto', value: 'auto' },
              { text: 'svg', value: 'svg' },
              { text: 'png', value: 'png' }
            ]
          },
          anchorMenu: {
            acceptReporters: true,
            items: [
              { text: 'center', value: 'center' },
              { text: 'top-left', value: 'top-left' },
              { text: 'top', value: 'top' },
              { text: 'top-right', value: 'top-right' },
              { text: 'left', value: 'left' },
              { text: 'right', value: 'right' },
              { text: 'bottom-left', value: 'bottom-left' },
              { text: 'bottom', value: 'bottom' },
              { text: 'bottom-right', value: 'bottom-right' }
            ]
          }
        }
      };
    }

    // ---------- Canvas overlay helpers ----------
    _ensureOverlay() {
      const vm = Scratch.vm;
      const renderer = vm && vm.renderer;
      if (!renderer) return;

      // Create overlay if not exist
      if (!this._overlay) {
        const parent = renderer.canvas && renderer.canvas.parentElement;
        if (!parent) return;

        const cnv = document.createElement('canvas');
        cnv.style.position = 'absolute';
        cnv.style.left = '0';
        cnv.style.top = '0';
        cnv.style.pointerEvents = 'none';
        cnv.style.zIndex = String(this._zIndex);
        // Ensure CSS size follows stage canvas CSS size
        cnv.style.width = renderer.canvas.style.width || '100%';
        cnv.style.height = renderer.canvas.style.height || '100%';

        parent.appendChild(cnv);

        this._overlay = cnv;
        this._ctx = cnv.getContext('2d');
      }

      this._syncCanvasWithStage();
      this._overlay.style.display = this._visible ? '' : 'none';
      if (this._ctx) {
        this._ctx.imageSmoothingEnabled = !!this._smoothing;
      }
    }

    _syncCanvasWithStage() {
      const renderer = Scratch.vm.renderer;
      if (!renderer || !renderer.canvas || !this._overlay) return;
      const stageCanvas = renderer.canvas;

      // Backing store size should match stage canvas to keep 1:1 pixel mapping
      const w = stageCanvas.width;
      const h = stageCanvas.height;

      if (w !== this._lastCanvasSize.w || h !== this._lastCanvasSize.h) {
        this._overlay.width = w;
        this._overlay.height = h;
        // CSS size follow stage canvas CSS size
        this._overlay.style.width = stageCanvas.style.width || '100%';
        this._overlay.style.height = stageCanvas.style.height || '100%';
        this._lastCanvasSize = { w, h };
      }
    }

    _clearCanvas() {
      this._ensureOverlay();
      if (!this._ctx || !this._overlay) return;
      this._ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);
    }

    // Stage coord (x,y) to overlay canvas pixel (px,py)
    _stageToCanvas(x, y) {
      const renderer = Scratch.vm.renderer;
      const sc = renderer.canvas;
      const scaleX = sc.width / 480;
      const scaleY = sc.height / 360;
      const cx = sc.width / 2;
      const cy = sc.height / 2;
      const px = cx + (x * scaleX);
      const py = cy - (y * scaleY);
      return { px, py, scaleX, scaleY };
    }

    // ---------- Texture helpers ----------
    async loadTexture(args) {
      const type = String(args.TYPE || 'auto').toLowerCase();
      const data = String(args.DATA || '').trim();

      this._ensureOverlay();

      let dataURL = data;
      const looksLikeDataURL = data.startsWith('data:');
      let inferred = type;

      if (!looksLikeDataURL) {
        // Build data URL based on type
        if (inferred === 'auto') {
          // Default to png
          inferred = 'png';
        }
        if (inferred === 'svg') {
          dataURL = 'data:image/svg+xml;base64,' + data;
        } else {
          dataURL = 'data:image/png;base64,' + data;
        }
      } else {
        // auto-detect from data URL header
        if (inferred === 'auto') {
          if (dataURL.startsWith('data:image/svg')) inferred = 'svg';
          else inferred = 'png';
        }
      }

      // Create image
      const img = new Image();
      // For data URLs crossOrigin is not needed, but keep consistent
      img.crossOrigin = 'anonymous';

      const loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error('纹理加载失败，请检查base64是否正确。'));
      });

      img.src = dataURL;
      try {
        await loaded;
      } catch (e) {
        console.warn(e);
        // Reset on failure
        this._img = null;
        this._imgNaturalWidth = 0;
        this._imgNaturalHeight = 0;
        return;
      }

      this._img = img;
      this._imgNaturalWidth = img.naturalWidth || 0;
      this._imgNaturalHeight = img.naturalHeight || 0;
    }

    draw(args) {
      if (!this._img) return;
      this._ensureOverlay();
      if (!this._ctx || !this._overlay) return;

      // Sync overlay size with stage in case of resize
      this._syncCanvasWithStage();

      let x = Number(args.X);
      let y = Number(args.Y);
      let w = Number(args.W);
      let h = Number(args.H);
      const anchor = String(args.ANCHOR || 'center').toLowerCase();

      // Fallback size if not provided or <= 0
      if (!(w > 0) || !(h > 0)) {
        // If natural size known, map to stage units (approx): 1 stage unit horizontally = 1 pixel at 480-wide logical stage.
        // But our draw uses stage units -> convert to pixels via scale in transform.
        // So keep w/h in stage units: we can approximate mapping: wStage = naturalWidth / scaleX, but unknown until we get scaleX.
        // Simpler: default to 100x100 stage units if invalid.
        w = w > 0 ? w : 100;
        h = h > 0 ? h : 100;
      }

      const { px, py, scaleX, scaleY } = this._stageToCanvas(x, y);
      const wPx = w * scaleX;
      const hPx = h * scaleY;

      // Compute anchor offsets
      const ax = this._anchorX(anchor);
      const ay = this._anchorY(anchor);
      const ox = -wPx * ax;
      const oy = -hPx * ay;

      const ctx = this._ctx;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, this._opacity / 100));
      ctx.imageSmoothingEnabled = !!this._smoothing;

      ctx.translate(px, py);
      const rad = (this._rotation || 0) * Math.PI / 180;
      if (rad !== 0) ctx.rotate(rad);

      ctx.drawImage(this._img, ox, oy, wPx, hPx);
      ctx.restore();
    }

    clear() {
      this._clearCanvas();
    }

    setOpacity(args) {
      let op = Number(args.OP);
      if (!Number.isFinite(op)) op = 100;
      this._opacity = Math.max(0, Math.min(100, op));
    }

    setRotation(args) {
      let deg = Number(args.DEG);
      if (!Number.isFinite(deg)) deg = 0;
      this._rotation = deg;
    }

    setSmoothing(args) {
      const on = !!args.ON;
      this._smoothing = on;
      if (this._ctx) this._ctx.imageSmoothingEnabled = on;
    }

    setVisible(args) {
      const on = !!args.ON;
      this._visible = on;
      this._ensureOverlay();
      if (this._overlay) {
        this._overlay.style.display = on ? '' : 'none';
      }
    }

    setZIndex(args) {
      let z = Number(args.Z);
      if (!Number.isFinite(z)) z = 100;
      this._zIndex = z;
      this._ensureOverlay();
      if (this._overlay) this._overlay.style.zIndex = String(z);
    }

    hasTexture() {
      return !!this._img;
    }

    textureSizeW() {
      return this._imgNaturalWidth || 0;
    }

    textureSizeH() {
      return this._imgNaturalHeight || 0;
    }

    // Anchor helpers
    _anchorX(anchor) {
      switch (anchor) {
        case 'top-left':
        case 'left':
        case 'bottom-left':
          return 0;
        case 'top-right':
        case 'right':
        case 'bottom-right':
          return 1;
        case 'top':
        case 'center':
        case 'bottom':
        default:
          return 0.5;
      }
    }

    _anchorY(anchor) {
      switch (anchor) {
        case 'top-left':
        case 'top':
        case 'top-right':
          return 0;
        case 'bottom-left':
        case 'bottom':
        case 'bottom-right':
          return 1;
        case 'left':
        case 'center':
        case 'right':
        default:
          return 0.5;
      }
    }
  }

  Scratch.extensions.register(new SVGTexture());
})(Scratch);