(function (Scratch) {
  'use strict';

  if (!Scratch || !Scratch.vm || !Scratch.vm.renderer || !Scratch.extensions) {
    console.warn('Texture extension: Scratch runtime not found.');
    return;
  }

  // Helper shader compile/link
  function compileShader(gl, src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader compile error: ' + info);
    }
    return s;
  }
  function createProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, vsSrc, gl.VERTEX_SHADER);
    const fs = compileShader(gl, fsSrc, gl.FRAGMENT_SHADER);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('Program link error: ' + info);
    }
    return p;
  }

  // Vertex shader uses center-based positions (-0.5..0.5) so rotation is around center
  const DEFAULT_VS = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform vec2 u_resolution;
    uniform vec2 u_translate; // pixel coordinate of image center
    uniform vec2 u_scale; // size in pixels (w,h)
    uniform float u_rotation;
    varying vec2 v_texCoord;
    void main() {
      vec2 pos = a_position * u_scale; // centered coordinates
      float s = sin(u_rotation);
      float c = cos(u_rotation);
      vec2 rotated = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
      vec2 pixelPos = rotated + u_translate;
      vec2 zeroToOne = pixelPos / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      v_texCoord = a_texCoord;
    }
  `;

  const PASSTHROUGH_FS = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_opacity;
    void main() {
      vec4 c = texture2D(u_texture, v_texCoord);
      c.a *= u_opacity;
      gl_FragColor = c;
    }
  `;

  // Glow shader includes 'color' uniform (vec3) for glow tint
  const GLOW_FS = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_opacity;
    uniform float threshold;
    uniform float intensity;
    uniform vec3 color;
    void main() {
      vec4 base = texture2D(u_texture, v_texCoord);
      float lum = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec4 glow = vec4(0.0);
      if (lum > threshold) {
        float off = 1.0 / 256.0;
        glow += texture2D(u_texture, v_texCoord + vec2(off, 0.0));
        glow += texture2D(u_texture, v_texCoord + vec2(-off, 0.0));
        glow += texture2D(u_texture, v_texCoord + vec2(0.0, off));
        glow += texture2D(u_texture, v_texCoord + vec2(0.0, -off));
        glow *= intensity * 0.25;
        glow.rgb *= color; // tint the glow
      }
      vec4 outColor = base + glow;
      outColor.a *= u_opacity;
      gl_FragColor = outColor;
    }
  `;

  class TextureExtension {
    constructor() {
      this._canvas = null;
      this._gl = null;

      // shaderName -> { program, attribs, uniforms, params }
      this._shaders = {};

      // textures: name -> { image, glTex, width, height, shaderName }
      this._textures = {};

      this._current = null; // selected texture name
      this._drawList = [];

      this._quadBuffer = null;
      this._texBuffer = null;

      this._defaultShaderName = 'passthrough';
      this._zIndex = 100;
      this._visible = true;

      // default smoothing off to avoid unintended blur
      this._smoothing = false;

      // Override rasterization resolution (global setting via block)
      // If null or {w:0,h:0} means use image natural size
      this._overrideResolution = { w: 0, h: 0 };

      this._lastCanvasSize = { w: 0, h: 0 };

      this._running = false;

      this._renderLoop = this._renderLoop.bind(this);
      this._ensureOverlay = this._ensureOverlay.bind(this);
      this._syncCanvasWithStage = this._syncCanvasWithStage.bind(this);
    }

    getInfo() {
      return {
        id: 'texture',
        name: 'Texture',
        // 半深蓝
        color1: '#4aa0d6',
        blocks: [
          // resolution control
          {
            opcode: 'setResolution',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置绘制分辨率 宽 [W] 高 [H]',
            arguments: {
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'getResolutionW',
            blockType: Scratch.BlockType.REPORTER,
            text: '绘制分辨率 宽'
          },
          {
            opcode: 'getResolutionH',
            blockType: Scratch.BlockType.REPORTER,
            text: '绘制分辨率 高'
          },

          // Texture management
          {
            opcode: 'createTexture',
            blockType: Scratch.BlockType.COMMAND,
            text: '创建纹理 名称 [NAME] 数据 [DATA] 类型 [TYPE] 并等待',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' },
              DATA: { type: Scratch.ArgumentType.STRING, defaultValue: 'data:image/png;base64,iVBORw0...' },
              TYPE: { type: Scratch.ArgumentType.STRING, menu: 'typeMenu', defaultValue: 'auto' }
            }
          },
          {
            opcode: 'deleteTexture',
            blockType: Scratch.BlockType.COMMAND,
            text: '删除纹理 [NAME]',
            arguments: { NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' } }
          },
          {
            opcode: 'selectTexture',
            blockType: Scratch.BlockType.COMMAND,
            text: '选择纹理 [NAME]',
            arguments: { NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' } }
          },
          // draw: NAME optional; if empty uses current selection
          {
            opcode: 'drawTexture',
            blockType: Scratch.BlockType.COMMAND,
            text: '绘制纹理 [NAME] 到 x [X] y [Y] 宽 [W] 高 [H] 锚点 [ANCHOR] 层 [LAYER] 旋转 [ROT] 透明 [OP]',
            arguments: {
              NAME: { type: Scratch.ArgumentType.STRING, defaultValue: '' },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              ANCHOR: { type: Scratch.ArgumentType.STRING, menu: 'anchorMenu', defaultValue: 'center' },
              LAYER: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              ROT: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              OP: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          {
            opcode: 'clear',
            blockType: Scratch.BlockType.COMMAND,
            text: '清空画布'
          },
          // global control
          {
            opcode: 'setVisible',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置可见为 [ON]',
            arguments: { ON: { type: Scratch.ArgumentType.BOOLEAN, defaultValue: true } }
          },
          {
            opcode: 'setZIndex',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置层级为 [Z]',
            arguments: { Z: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 } }
          },
          {
            opcode: 'setSmoothing',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置平滑插值为 [ON]',
            arguments: { ON: { type: Scratch.ArgumentType.BOOLEAN, defaultValue: false } }
          },

          // shader management
          {
            opcode: 'createShader',
            blockType: Scratch.BlockType.COMMAND,
            text: '创建着色器 名称 [SNAME] 源 [FSRC] 并等待',
            arguments: { SNAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'myshader' }, FSRC: { type: Scratch.ArgumentType.STRING, defaultValue: 'precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_texture; void main(){ gl_FragColor = texture2D(u_texture, v_texCoord); }' } }
          },
          {
            opcode: 'deleteShader',
            blockType: Scratch.BlockType.COMMAND,
            text: '删除着色器 [SNAME]',
            arguments: { SNAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'myshader' } }
          },
          {
            opcode: 'assignShader',
            blockType: Scratch.BlockType.COMMAND,
            text: '将着色器 [SNAME] 指派给纹理 [TNAME]',
            arguments: { SNAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'glow' }, TNAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' } }
          },
          {
            opcode: 'setShaderParam',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置着色器 [SNAME] 参数 [PARAM] 为 [VAL]',
            arguments: { SNAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'glow' }, PARAM: { type: Scratch.ArgumentType.STRING, defaultValue: 'threshold' }, VAL: { type: Scratch.ArgumentType.STRING, defaultValue: '0.5' } }
          },
          // info
          {
            opcode: 'hasTexture',
            blockType: Scratch.BlockType.BOOLEAN,
            text: '已加载纹理 [NAME]？',
            arguments: { NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' } }
          },
          {
            opcode: 'textureSizeW',
            blockType: Scratch.BlockType.REPORTER,
            text: '纹理 [NAME] 宽度',
            arguments: { NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' } }
          },
          {
            opcode: 'textureSizeH',
            blockType: Scratch.BlockType.REPORTER,
            text: '纹理 [NAME] 高度',
            arguments: { NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 't1' } }
          }
        ],
        menus: {
          typeMenu: { acceptReporters: true, items: [{ text: 'auto', value: 'auto' }, { text: 'svg', value: 'svg' }, { text: 'png', value: 'png' },{ text: 'svg+xml', value: 'svg+xml' }] },
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

    // ---------- Overlay & GL ----------
    _ensureOverlay() {
      const renderer = Scratch.vm.renderer;
      if (!renderer || !renderer.canvas) return;
      const parent = renderer.canvas.parentElement;
      if (!parent) return;

      if (!this._canvas) {
        const cnv = document.createElement('canvas');
        cnv.style.position = 'absolute';
        cnv.style.left = '0';
        cnv.style.top = '0';
        cnv.style.pointerEvents = 'none';
        cnv.style.zIndex = String(this._zIndex);
        cnv.style.width = renderer.canvas.style.width || '100%';
        cnv.style.height = renderer.canvas.style.height || '100%';
        parent.appendChild(cnv);
        this._canvas = cnv;
      }

      if (!this._gl) {
        const gl = this._canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false }) ||
          this._canvas.getContext('experimental-webgl', { premultipliedAlpha: false, antialias: false });
        if (!gl) {
          console.warn('Texture extension: WebGL not available.');
          return;
        }
        this._gl = gl;

        // center-based quad coords
        const positions = new Float32Array([
          -0.5, -0.5,
          0.5, -0.5,
          -0.5, 0.5,
          0.5, 0.5
        ]);
        const texs = new Float32Array([
          0, 0,
          1, 0,
          0, 1,
          1, 1
        ]);
        this._quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this._texBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texs, gl.STATIC_DRAW);

        // default shaders
        try {
          this._createShaderInternal(this._defaultShaderName, PASSTHROUGH_FS);
          this._createShaderInternal('glow', GLOW_FS);
          if (this._shaders.glow) {
            this._shaders.glow.params = { threshold: 0.6, intensity: 2.0, color: [1.0, 0.9, 0.6] };
          }
        } catch (e) {
          console.warn('shader init failed', e);
        }
      }

      this._syncCanvasWithStage();

      if (!this._running) {
        this._running = true;
        requestAnimationFrame(this._renderLoop);
      }

      this._canvas.style.display = this._visible ? '' : 'none';
      this._canvas.style.zIndex = String(this._zIndex);
    }

    _syncCanvasWithStage() {
      const renderer = Scratch.vm.renderer;
      if (!renderer || !renderer.canvas || !this._canvas) return;
      const stageCanvas = renderer.canvas;
      const w = stageCanvas.width;
      const h = stageCanvas.height;
      if (w !== this._lastCanvasSize.w || h !== this._lastCanvasSize.h) {
        this._canvas.width = w;
        this._canvas.height = h;
        this._canvas.style.width = stageCanvas.style.width || '100%';
        this._canvas.style.height = stageCanvas.style.height || '100%';
        this._lastCanvasSize = { w, h };
      }
      if (this._gl) this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);
    }

    // ---------- Texture loading and optional rasterization ----------
    // data: user input string; type: 'auto'|'svg'|'png'
    // data: user input string; type: 'auto' | 'svg+xml' | 'data:svg' | 'data:png' (or other legacy)
    // 返回 Promise<Image>
    async _loadImageFromData(data, type) {
      let src = (data || '').trim();
      const t = (type || 'auto').toLowerCase();

      // 如果已经是完整 data: URL，直接使用
      if (src.startsWith('data:')) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('纹理图片加载失败: ' + (e && e.message)));
          img.src = src;
        });
      }

      // Helper: create data URL for raw SVG text
      function svgTextToDataURL(svgText) {
        // 推荐使用 encodeURIComponent 方法（更兼容直接包含 UTF-8 字符的情况）
        // 形式: data:image/svg+xml;charset=utf-8,<encoded SVG>
        try {
          return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        } catch (e) {
          // 备选：base64 编码（需先将 Unicode 转成字节）
          try {
            const b64 = btoa(unescape(encodeURIComponent(svgText)));
            return 'data:image/svg+xml;base64,' + b64;
          } catch (e2) {
            // 回退到 encodeURIComponent，即便有风险也试一试
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
          }
        }
      }

      // 处理 svg+xml 类型：把输入直接当做 SVG 标签文本（即便没有以 '<' 开头也强制当作 svg）
      if (t === 'svg+xml') {
        // 如果用户传入的就是 SVG 文本（或以 '<' 开头），直接转 data URL
        const svgText = src;
        const dataURL = svgTextToDataURL(svgText);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('SVG 纹理加载失败: ' + (e && e.message)));
          img.src = dataURL;
        });
      }

      // 处理 data:svg 类型 —— 期望输入为 base64 内容或裸 base64（未带 data: 前缀）
      if (t === 'data:svg') {
        // 如果输入看起来像 SVG 文本（以 '<' 开头），也接受并编码为 data URL
        if (src.startsWith('<')) {
          const dataURL = svgTextToDataURL(src);
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error('SVG 纹理加载失败: ' + (e && e.message)));
            img.src = dataURL;
          });
        }
        // 否则假定用户提供的是 base64（或裸 base64），构建 data:image/svg+xml;base64,...
        const maybeB64 = src;
        const dataURL = maybeB64.startsWith('base64,') ? ('data:image/svg+xml;' + maybeB64) : ('data:image/svg+xml;base64,' + maybeB64);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('SVG(base64) 纹理加载失败: ' + (e && e.message)));
          img.src = dataURL;
        });
      }

      // 处理 data:png 类型 —— 同上，假定输入为 base64 内容（或裸 base64）
      if (t === 'data:png') {
        const maybeB64 = src;
        const dataURL = maybeB64.startsWith('base64,') ? ('data:image/png;' + maybeB64) : ('data:image/png;base64,' + maybeB64);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('PNG(base64) 纹理加载失败: ' + (e && e.message)));
          img.src = dataURL;
        });
      }

      // type = auto 或其它：智能判断
      // 如果输入看起来像 SVG 文本（以 '<' 开头），当作 svg+xml 处理
      if (src.startsWith('<')) {
        const dataURL = svgTextToDataURL(src);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('SVG 纹理加载失败: ' + (e && e.message)));
          img.src = dataURL;
        });
      }

      // 其它情况：默认当作 base64 png 内容处理（与之前的 auto 行为兼容）
      {
        const maybeB64 = src;
        const dataURL = maybeB64.startsWith('base64,') ? ('data:image/png;' + maybeB64) : ('data:image/png;base64,' + maybeB64);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('PNG(base64) 纹理加载失败: ' + (e && e.message)));
          img.src = dataURL;
        });
      }
    }

    // Rasterize image into an offscreen canvas at override resolution if set
    _rasterizeToResolution(img) {
      const res = this._overrideResolution || { w: 0, h: 0 };
      const w = Number(res.w) || 0;
      const h = Number(res.h) || 0;
      if (!(w > 0 && h > 0)) {
        // no override -> return original image
        return img;
      }
      // draw into offscreen canvas of size w x h
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d');
      // fill transparent then draw image stretched to fit resolution
      ctx.clearRect(0, 0, w, h);
      // For SVG, drawing scaled to target resolution is desired.
      ctx.drawImage(img, 0, 0, w, h);
      return off;
    }

    _createGLTextureFromImage(imgSource) {
      const gl = this._gl;
      if (!gl) return null;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      // imgSource can be Image or Canvas
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgSource);
      if (this._smoothing) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return tex;
    }

    // ---------- Shader management ----------
    _createShaderInternal(name, fsSrc) {
      if (!this._gl) throw new Error('GL not initialized');
      const program = createProgram(this._gl, DEFAULT_VS, fsSrc);
      const attribs = {
        a_position: this._gl.getAttribLocation(program, 'a_position'),
        a_texCoord: this._gl.getAttribLocation(program, 'a_texCoord')
      };
      const uniforms = {
        u_resolution: this._gl.getUniformLocation(program, 'u_resolution'),
        u_translate: this._gl.getUniformLocation(program, 'u_translate'),
        u_scale: this._gl.getUniformLocation(program, 'u_scale'),
        u_rotation: this._gl.getUniformLocation(program, 'u_rotation'),
        u_texture: this._gl.getUniformLocation(program, 'u_texture'),
        u_opacity: this._gl.getUniformLocation(program, 'u_opacity')
      };
      this._shaders[name] = { program, attribs, uniforms, params: {} };
    }

    createShader(args) {
      const name = String(args.SNAME || 'myshader');
      const src = String(args.FSRC || '').trim();
      this._ensureOverlay();
      try {
        this._createShaderInternal(name, src);
      } catch (e) {
        console.warn('createShader failed:', e);
      }
    }

    deleteShader(args) {
      const name = String(args.SNAME || '');
      if (!this._shaders[name]) return;
      if (this._gl) {
        try { this._gl.deleteProgram(this._shaders[name].program); } catch (e) { }
      }
      delete this._shaders[name];
    }

    setShaderParam(args) {
      const name = String(args.SNAME || '');
      const param = String(args.PARAM || '');
      const val = String(args.VAL || '');
      if (!this._shaders[name]) return;
      const v = this._parseParamString(val);
      this._shaders[name].params[param] = v;
    }

    assignShader(args) {
      const sname = String(args.SNAME || '');
      const tname = String(args.TNAME || '');
      if (!this._textures[tname]) return;
      if (!this._shaders[sname]) {
        console.warn('assignShader: shader not found', sname);
        return;
      }
      this._textures[tname].shaderName = sname;
    }

    // ---------- Resolution blocks ----------
    setResolution(args) {
      const w = Math.max(0, Math.floor(Number(args.W) || 0));
      const h = Math.max(0, Math.floor(Number(args.H) || 0));
      this._overrideResolution = { w, h };
      // Note: this only affects subsequent createTexture operations.
    }
    getResolutionW() { return this._overrideResolution ? (this._overrideResolution.w || 0) : 0; }
    getResolutionH() { return this._overrideResolution ? (this._overrideResolution.h || 0) : 0; }

    // ---------- Texture creation/deletion/select ----------
    async createTexture(args) {
      const name = String(args.NAME || 't1');
      const data = String(args.DATA || '');
      const type = String(args.TYPE || 'auto');
      this._ensureOverlay();
      try {
        const img = await this._loadImageFromData(data, type);
        // rasterize if resolution override present
        const sourceForGL = this._rasterizeToResolution(img);
        // delete old gl texture
        if (this._textures[name] && this._textures[name].glTex && this._gl) {
          try { this._gl.deleteTexture(this._textures[name].glTex); } catch (e) { }
        }
        let glTex = null;
        if (this._gl) glTex = this._createGLTextureFromImage(sourceForGL);
        const storedWidth = (sourceForGL.width) || (img.naturalWidth || img.width) || 0;
        const storedHeight = (sourceForGL.height) || (img.naturalHeight || img.height) || 0;
        this._textures[name] = { image: img, glTex, width: storedWidth, height: storedHeight, shaderName: this._defaultShaderName };
        if (!this._current) this._current = name;
      } catch (e) {
        console.warn('createTexture error', e);
      }
    }

    deleteTexture(args) {
      const name = String(args.NAME || '');
      if (!this._textures[name]) return;
      if (this._textures[name].glTex && this._gl) {
        try { this._gl.deleteTexture(this._textures[name].glTex); } catch (e) { }
      }
      delete this._textures[name];
      if (this._current === name) this._current = null;
    }

    selectTexture(args) {
      const name = String(args.NAME || '');
      if (this._textures[name]) this._current = name;
    }

    hasTexture(args) {
      const name = String(args.NAME || '');
      return !!this._textures[name];
    }
    textureSizeW(args) {
      const name = String(args.NAME || '');
      return (this._textures[name] && this._textures[name].width) || 0;
    }
    textureSizeH(args) {
      const name = String(args.NAME || '');
      return (this._textures[name] && this._textures[name].height) || 0;
    }

    // ---------- Drawing ----------
    drawTexture(args) {
      let name = String(args.NAME || '');
      if (!name) name = this._current;
      if (!name || !this._textures[name]) return;
      const x = Number(args.X || 0);
      const y = Number(args.Y || 0);
      const w = Number(args.W || 100);
      const h = Number(args.H || 100);
      const anchor = String(args.ANCHOR || 'center');
      const layer = Number(args.LAYER || 0) || 0;
      const rot = Number(args.ROT || 0) || 0;
      const op = Number(args.OP || 100) || 100;
      this._drawList.push({ name, x, y, w, h, anchor, layer, rotation: rot, opacity: op / 100 });
    }

    clear() {
      this._drawList = [];
      if (this._gl) {
        const gl = this._gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (this._canvas && this._canvas.getContext) {
        const ctx = this._canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
    }

    setVisible(args) {
      this._visible = !!args.ON;
      this._ensureOverlay();
      if (this._canvas) this._canvas.style.display = this._visible ? '' : 'none';
    }

    setZIndex(args) {
      const z = Number(args.Z || 100) || 100;
      this._zIndex = z;
      this._ensureOverlay();
      if (this._canvas) this._canvas.style.zIndex = String(z);
    }

    setSmoothing(args) {
      this._smoothing = !!args.ON;
      if (this._gl) {
        const gl = this._gl;
        for (const k in this._textures) {
          const t = this._textures[k];
          if (t.glTex) {
            gl.bindTexture(gl.TEXTURE_2D, t.glTex);
            if (this._smoothing) {
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            } else {
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
          }
        }
      }
    }

    // ---------- Render loop ----------
    _renderLoop() {
      this._ensureOverlay();
      this._syncCanvasWithStage();
      if (!this._gl || !this._canvas) {
        requestAnimationFrame(this._renderLoop);
        return;
      }
      const gl = this._gl;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const list = this._drawList.slice().sort((a, b) => a.layer - b.layer);
      for (const item of list) {
        const texInfo = this._textures[item.name];
        if (!texInfo || !texInfo.glTex) continue;
        const shaderName = texInfo.shaderName || this._defaultShaderName;
        const shader = this._shaders[shaderName] || this._shaders[this._defaultShaderName];
        if (!shader) continue;
        const program = shader.program;
        gl.useProgram(program);

        // attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        const a_pos = shader.attribs.a_position;
        if (a_pos >= 0) { gl.enableVertexAttribArray(a_pos); gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0); }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._texBuffer);
        const a_tex = shader.attribs.a_texCoord;
        if (a_tex >= 0) { gl.enableVertexAttribArray(a_tex); gl.vertexAttribPointer(a_tex, 2, gl.FLOAT, false, 0, 0); }

        // stage -> canvas px
        const renderer = Scratch.vm.renderer;
        const sc = renderer.canvas;
        const scaleX = sc.width / 480;
        const scaleY = sc.height / 360;
        const cx = sc.width / 2;
        const cy = sc.height / 2;
        const px = cx + (item.x * scaleX);
        const py = cy - (item.y * scaleY);
        const wPx = item.w * scaleX;
        const hPx = item.h * scaleY;

        // compute center translate considering anchor:
        const ax = this._anchorX(item.anchor);
        const ay = this._anchorY(item.anchor);
        const centerX = px + (0.5 - ax) * wPx;
        const centerY = py + (0.5 - ay) * hPx;

        // uniforms
        const u = shader.uniforms;
        if (u.u_resolution) gl.uniform2f(u.u_resolution, this._canvas.width, this._canvas.height);
        if (u.u_translate) gl.uniform2f(u.u_translate, centerX, centerY);
        if (u.u_scale) gl.uniform2f(u.u_scale, wPx, hPx);
        if (u.u_rotation) gl.uniform1f(u.u_rotation, (item.rotation || 0) * Math.PI / 180);
        if (u.u_opacity) gl.uniform1f(u.u_opacity, item.opacity || 1.0);
        if (u.u_texture) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texInfo.glTex);
          gl.uniform1i(u.u_texture, 0);
        }

        // shader params
        const params = shader.params || {};
        for (const key in params) {
          const loc = gl.getUniformLocation(program, key);
          if (!loc) continue;
          const val = params[key];
          if (typeof val === 'number') gl.uniform1f(loc, val);
          else if (Array.isArray(val)) {
            if (val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2]);
            else if (val.length === 4) gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
          } else if (typeof val === 'string') {
            const parsed = this._parseParamString(val);
            if (typeof parsed === 'number') gl.uniform1f(loc, parsed);
            else if (Array.isArray(parsed) && parsed.length === 3) gl.uniform3f(loc, parsed[0], parsed[1], parsed[2]);
          }
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (a_pos >= 0) gl.disableVertexAttribArray(a_pos);
        if (a_tex >= 0) gl.disableVertexAttribArray(a_tex);
      }

      requestAnimationFrame(this._renderLoop);
    }

    // ---------- Utilities ----------
    _parseParamString(str) {
      const s = (str || '').trim();
      if (!isNaN(Number(s))) return Number(s);
      if (s.indexOf(',') >= 0) {
        const parts = s.split(',').map(p => p.trim());
        const nums = parts.map(p => Number(p)).filter(n => !isNaN(n));
        if (nums.length === parts.length) return nums;
      }
      if (s[0] === '#') {
        let hex = s.substr(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        if (hex.length === 6) {
          const r = parseInt(hex.substr(0, 2), 16) / 255;
          const g = parseInt(hex.substr(2, 2), 16) / 255;
          const b = parseInt(hex.substr(4, 2), 16) / 255;
          return [r, g, b];
        }
      }
      const m = s.match(/rgb\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/i);
      if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
      return s;
    }

    _anchorX(anchor) {
      switch ((anchor || '').toLowerCase()) {
        case 'top-left': case 'left': case 'bottom-left': return 0;
        case 'top-right': case 'right': case 'bottom-right': return 1;
        default: return 0.5;
      }
    }
    _anchorY(anchor) {
      switch ((anchor || '').toLowerCase()) {
        case 'top-left': case 'top': case 'top-right': return 0;
        case 'bottom-left': case 'bottom': case 'bottom-right': return 1;
        default: return 0.5;
      }
    }
  }

  Scratch.extensions.register(new TextureExtension());
})(Scratch);