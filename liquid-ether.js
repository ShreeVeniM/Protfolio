(function () {
  'use strict';

  /* ── Shaders ── */
  const face_vert = `
    attribute vec3 position;
    uniform vec2 px;
    uniform vec2 boundarySpace;
    varying vec2 uv;
    precision highp float;
    void main(){
      vec3 pos = position;
      vec2 scale = 1.0 - boundarySpace * 2.0;
      pos.xy = pos.xy * scale;
      uv = vec2(0.5) + (pos.xy) * 0.5;
      gl_Position = vec4(pos, 1.0);
    }
  `;

  const line_vert = `
    attribute vec3 position;
    uniform vec2 px;
    precision highp float;
    varying vec2 uv;
    void main(){
      vec3 pos = position;
      uv = 0.5 + pos.xy * 0.5;
      vec2 n = sign(pos.xy);
      pos.xy = abs(pos.xy) - px * 1.0;
      pos.xy *= n;
      gl_Position = vec4(pos, 1.0);
    }
  `;

  const mouse_vert = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
      vec2 pos = position.xy * scale * 2.0 * px + center;
      vUv = uv;
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const advection_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform bool isBFECC;
    uniform vec2 fboSize;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
      vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
      if(isBFECC == false){
        vec2 vel = texture2D(velocity, uv).xy;
        vec2 uv2 = uv - vel * dt * ratio;
        vec2 newVel = texture2D(velocity, uv2).xy;
        gl_FragColor = vec4(newVel, 0.0, 0.0);
      } else {
        vec2 spot_new = uv;
        vec2 vel_old = texture2D(velocity, uv).xy;
        vec2 spot_old = spot_new - vel_old * dt * ratio;
        vec2 vel_new1 = texture2D(velocity, spot_old).xy;
        vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
        vec2 error = spot_new2 - spot_new;
        vec2 spot_new3 = spot_new - error / 2.0;
        vec2 vel_2 = texture2D(velocity, spot_new3).xy;
        vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
        vec2 newVel2 = texture2D(velocity, spot_old2).xy;
        gl_FragColor = vec4(newVel2, 0.0, 0.0);
      }
    }
  `;

  const color_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D palette;
    uniform vec4 bgColor;
    varying vec2 uv;
    void main(){
      vec2 vel = texture2D(velocity, uv).xy;
      float lenv = clamp(length(vel), 0.0, 1.0);
      vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb;
      vec3 outRGB = mix(bgColor.rgb, c, lenv);
      float outA = mix(bgColor.a, 1.0, lenv);
      gl_FragColor = vec4(outRGB, outA);
    }
  `;

  const divergence_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
      float x0 = texture2D(velocity, uv - vec2(px.x, 0.0)).x;
      float x1 = texture2D(velocity, uv + vec2(px.x, 0.0)).x;
      float y0 = texture2D(velocity, uv - vec2(0.0, px.y)).y;
      float y1 = texture2D(velocity, uv + vec2(0.0, px.y)).y;
      float divergence = (x1 - x0 + y1 - y0) / 2.0;
      gl_FragColor = vec4(divergence / dt);
    }
  `;

  const externalForce_frag = `
    precision highp float;
    uniform vec2 force;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
      vec2 circle = (vUv - 0.5) * 2.0;
      float d = 1.0 - min(length(circle), 1.0);
      d *= d;
      gl_FragColor = vec4(force * d, 0.0, 1.0);
    }
  `;

  const poisson_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D divergence;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
      float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
      float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
      float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
      float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
      float div = texture2D(divergence, uv).r;
      float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
      gl_FragColor = vec4(newP);
    }
  `;

  const pressure_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D velocity;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
      float step = 1.0;
      float p0 = texture2D(pressure, uv + vec2(px.x * step, 0.0)).r;
      float p1 = texture2D(pressure, uv - vec2(px.x * step, 0.0)).r;
      float p2 = texture2D(pressure, uv + vec2(0.0, px.y * step)).r;
      float p3 = texture2D(pressure, uv - vec2(0.0, px.y * step)).r;
      vec2 v = texture2D(velocity, uv).xy;
      vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
      v = v - gradP * dt;
      gl_FragColor = vec4(v, 0.0, 1.0);
    }
  `;

  const viscous_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D velocity_new;
    uniform float v;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
      vec2 old = texture2D(velocity, uv).xy;
      vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy;
      vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy;
      vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy;
      vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy;
      vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
      newv /= 4.0 * (1.0 + v * dt);
      gl_FragColor = vec4(newv, 0.0, 0.0);
    }
  `;

  /* ── Configuration ── */
  const CONFIG = {
    colors: ['#9333ea', '#c026d3', '#c084fc'],
    mouseForce: 20,
    cursorSize: 100,
    isViscous: true,
    viscous: 30,
    iterationsViscous: 32,
    iterationsPoisson: 32,
    dt: 0.014,
    BFECC: true,
    resolution: 0.5,
    isBounce: false,
    autoDemo: true,
    autoSpeed: 0.5,
    autoIntensity: 2.2,
    takeoverDuration: 0.25,
    autoResumeDelay: 3000,
    autoRampDuration: 0.6
  };

  /* ── Palette Texture ── */
  function makePaletteTexture(stops) {
    let arr = (stops && stops.length > 0) ? (stops.length === 1 ? [stops[0], stops[0]] : stops) : ['#ffffff', '#ffffff'];
    const w = arr.length;
    const data = new Uint8Array(w * 4);
    for (let i = 0; i < w; i++) {
      const c = new THREE.Color(arr[i]);
      data[i * 4 + 0] = Math.round(c.r * 255);
      data[i * 4 + 1] = Math.round(c.g * 255);
      data[i * 4 + 2] = Math.round(c.b * 255);
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  const paletteTex = makePaletteTexture(CONFIG.colors);
  const bgVec4 = new THREE.Vector4(0, 0, 0, 0);

  /* ── Common ── */
  const Common = {
    width: 0, height: 0, aspect: 1, pixelRatio: 1,
    renderer: null, clock: null, time: 0, delta: 0, container: null,
    init(container) {
      this.container = container;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.resize();
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.autoClear = false;
      this.renderer.setClearColor(new THREE.Color(0x000000), 0);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(this.width, this.height);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
      this.clock = new THREE.Clock();
      this.clock.start();
    },
    resize() {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      this.width = Math.max(1, Math.floor(rect.width));
      this.height = Math.max(1, Math.floor(rect.height));
      this.aspect = this.width / this.height;
      if (this.renderer) this.renderer.setSize(this.width, this.height, false);
    },
    update() {
      this.delta = this.clock.getDelta();
      this.time += this.delta;
    }
  };

  /* ── Mouse ── */
  const Mouse = {
    mouseMoved: false,
    coords: new THREE.Vector2(),
    coords_old: new THREE.Vector2(),
    diff: new THREE.Vector2(),
    timer: null,
    container: null,
    isHoverInside: false,
    hasUserControl: false,
    isAutoActive: false,
    autoIntensity: CONFIG.autoIntensity,
    takeoverActive: false,
    takeoverStartTime: 0,
    takeoverDuration: CONFIG.takeoverDuration,
    takeoverFrom: new THREE.Vector2(),
    takeoverTo: new THREE.Vector2(),
    onInteract: null,

    init(container) {
      this.container = container;
      window.addEventListener('mousemove', (e) => this._onMouseMove(e));
      window.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
      window.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: true });
      window.addEventListener('touchend', () => { this.isHoverInside = false; });
      document.addEventListener('mouseleave', () => { this.isHoverInside = false; });
    },

    isPointInside(cx, cy) {
      if (!this.container) return false;
      const r = this.container.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    },

    setCoords(x, y) {
      if (!this.container) return;
      if (this.timer) clearTimeout(this.timer);
      const r = this.container.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const nx = (x - r.left) / r.width;
      const ny = (y - r.top) / r.height;
      this.coords.set(nx * 2 - 1, -(ny * 2 - 1));
      this.mouseMoved = true;
      this.timer = setTimeout(() => { this.mouseMoved = false; }, 100);
    },

    setNormalized(nx, ny) {
      this.coords.set(nx, ny);
      this.mouseMoved = true;
    },

    _onMouseMove(e) {
      this.isHoverInside = this.isPointInside(e.clientX, e.clientY);
      if (!this.isHoverInside) return;
      if (this.onInteract) this.onInteract();
      if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
        const r = this.container.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const nx = (e.clientX - r.left) / r.width;
        const ny = (e.clientY - r.top) / r.height;
        this.takeoverFrom.copy(this.coords);
        this.takeoverTo.set(nx * 2 - 1, -(ny * 2 - 1));
        this.takeoverStartTime = performance.now();
        this.takeoverActive = true;
        this.hasUserControl = true;
        this.isAutoActive = false;
        return;
      }
      this.setCoords(e.clientX, e.clientY);
      this.hasUserControl = true;
    },

    _onTouchStart(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      this.isHoverInside = this.isPointInside(t.clientX, t.clientY);
      if (!this.isHoverInside) return;
      if (this.onInteract) this.onInteract();
      this.setCoords(t.clientX, t.clientY);
      this.hasUserControl = true;
    },

    _onTouchMove(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      this.isHoverInside = this.isPointInside(t.clientX, t.clientY);
      if (!this.isHoverInside) return;
      if (this.onInteract) this.onInteract();
      this.setCoords(t.clientX, t.clientY);
    },

    update() {
      if (this.takeoverActive) {
        const t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
        if (t >= 1) {
          this.takeoverActive = false;
          this.coords.copy(this.takeoverTo);
          this.coords_old.copy(this.coords);
          this.diff.set(0, 0);
        } else {
          const k = t * t * (3 - 2 * t);
          this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
        }
      }
      this.diff.subVectors(this.coords, this.coords_old);
      this.coords_old.copy(this.coords);
      if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
      if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
    }
  };

  /* ── AutoDriver ── */
  class AutoDriver {
    constructor(mouse, manager, opts) {
      this.mouse = mouse;
      this.manager = manager;
      this.enabled = opts.enabled;
      this.speed = opts.speed;
      this.resumeDelay = opts.resumeDelay || 3000;
      this.rampDurationMs = (opts.rampDuration || 0) * 1000;
      this.active = false;
      this.current = new THREE.Vector2(0, 0);
      this.target = new THREE.Vector2();
      this.lastTime = performance.now();
      this.activationTime = 0;
      this.margin = 0.2;
      this._tmpDir = new THREE.Vector2();
      this.pickNewTarget();
    }
    pickNewTarget() {
      this.target.set((Math.random() * 2 - 1) * (1 - this.margin), (Math.random() * 2 - 1) * (1 - this.margin));
    }
    forceStop() {
      this.active = false;
      this.mouse.isAutoActive = false;
    }
    update() {
      if (!this.enabled) return;
      const now = performance.now();
      if (now - this.manager.lastUserInteraction < this.resumeDelay) {
        if (this.active) this.forceStop();
        return;
      }
      if (this.mouse.isHoverInside) {
        if (this.active) this.forceStop();
        return;
      }
      if (!this.active) {
        this.active = true;
        this.current.copy(this.mouse.coords);
        this.lastTime = now;
        this.activationTime = now;
      }
      this.mouse.isAutoActive = true;
      let dtSec = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dtSec > 0.2) dtSec = 0.016;
      const dir = this._tmpDir.subVectors(this.target, this.current);
      const dist = dir.length();
      if (dist < 0.01) { this.pickNewTarget(); return; }
      dir.normalize();
      let ramp = 1;
      if (this.rampDurationMs > 0) {
        const t = Math.min(1, (now - this.activationTime) / this.rampDurationMs);
        ramp = t * t * (3 - 2 * t);
      }
      const move = Math.min(this.speed * dtSec * ramp, dist);
      this.current.addScaledVector(dir, move);
      this.mouse.setNormalized(this.current.x, this.current.y);
    }
  }

  /* ── ShaderPass ── */
  class ShaderPass {
    constructor(props) {
      this.props = props || {};
      this.uniforms = this.props.material?.uniforms;
      this.scene = null; this.camera = null; this.material = null; this.geometry = null; this.plane = null;
    }
    init() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.Camera();
      if (this.uniforms) {
        this.material = new THREE.RawShaderMaterial(this.props.material);
        this.geometry = new THREE.PlaneGeometry(2.0, 2.0);
        this.plane = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.plane);
      }
    }
    update() {
      Common.renderer.setRenderTarget(this.props.output || null);
      Common.renderer.render(this.scene, this.camera);
      Common.renderer.setRenderTarget(null);
    }
  }

  /* ── Advection ── */
  class Advection extends ShaderPass {
    constructor(simProps) {
      super({
        material: {
          vertexShader: face_vert, fragmentShader: advection_frag,
          uniforms: {
            boundarySpace: { value: simProps.cellScale }, px: { value: simProps.cellScale },
            fboSize: { value: simProps.fboSize }, velocity: { value: simProps.src.texture },
            dt: { value: simProps.dt }, isBFECC: { value: true }
          }
        }, output: simProps.dst
      });
      this.uniforms = this.props.material.uniforms;
      this.init();
    }
    init() {
      super.init();
      const boundaryG = new THREE.BufferGeometry();
      const v = new Float32Array([-1,-1,0,-1,1,0,-1,1,0,1,1,0,1,1,0,1,-1,0,1,-1,0,-1,-1,0]);
      boundaryG.setAttribute('position', new THREE.BufferAttribute(v, 3));
      const boundaryM = new THREE.RawShaderMaterial({ vertexShader: line_vert, fragmentShader: advection_frag, uniforms: this.uniforms });
      this.line = new THREE.LineSegments(boundaryG, boundaryM);
      this.scene.add(this.line);
    }
    update(p) {
      this.uniforms.dt.value = p.dt;
      this.line.visible = p.isBounce;
      this.uniforms.isBFECC.value = p.BFECC;
      super.update();
    }
  }

  /* ── ExternalForce ── */
  class ExternalForce extends ShaderPass {
    constructor(simProps) {
      super({ output: simProps.dst });
      this.scene = new THREE.Scene();
      this.camera = new THREE.Camera();
      const mouseG = new THREE.PlaneGeometry(1, 1);
      const mouseM = new THREE.RawShaderMaterial({
        vertexShader: mouse_vert, fragmentShader: externalForce_frag,
        blending: THREE.AdditiveBlending, depthWrite: false,
        uniforms: {
          px: { value: simProps.cellScale }, force: { value: new THREE.Vector2(0, 0) },
          center: { value: new THREE.Vector2(0, 0) },
          scale: { value: new THREE.Vector2(simProps.cursor_size, simProps.cursor_size) }
        }
      });
      this.mouse = new THREE.Mesh(mouseG, mouseM);
      this.scene.add(this.mouse);
    }
    update(p) {
      const u = this.mouse.material.uniforms;
      u.force.value.set((Mouse.diff.x / 2) * p.mouse_force, (Mouse.diff.y / 2) * p.mouse_force);
      const csX = p.cursor_size * p.cellScale.x, csY = p.cursor_size * p.cellScale.y;
      u.center.value.set(
        Math.min(Math.max(Mouse.coords.x, -1 + csX + p.cellScale.x * 2), 1 - csX - p.cellScale.x * 2),
        Math.min(Math.max(Mouse.coords.y, -1 + csY + p.cellScale.y * 2), 1 - csY - p.cellScale.y * 2)
      );
      u.scale.value.set(p.cursor_size, p.cursor_size);
      super.update();
    }
  }

  /* ── Viscous ── */
  class Viscous extends ShaderPass {
    constructor(simProps) {
      super({
        material: {
          vertexShader: face_vert, fragmentShader: viscous_frag,
          uniforms: {
            boundarySpace: { value: simProps.boundarySpace }, velocity: { value: simProps.src.texture },
            velocity_new: { value: simProps.dst_.texture }, v: { value: simProps.viscous },
            px: { value: simProps.cellScale }, dt: { value: simProps.dt }
          }
        }, output: simProps.dst, output0: simProps.dst_, output1: simProps.dst
      });
      this.init();
    }
    update(p) {
      let fbo_in, fbo_out;
      this.uniforms.v.value = p.viscous;
      for (let i = 0; i < p.iterations; i++) {
        fbo_in = (i % 2 === 0) ? this.props.output0 : this.props.output1;
        fbo_out = (i % 2 === 0) ? this.props.output1 : this.props.output0;
        this.uniforms.velocity_new.value = fbo_in.texture;
        this.props.output = fbo_out;
        this.uniforms.dt.value = p.dt;
        super.update();
      }
      return fbo_out;
    }
  }

  /* ── Divergence ── */
  class Divergence extends ShaderPass {
    constructor(simProps) {
      super({
        material: {
          vertexShader: face_vert, fragmentShader: divergence_frag,
          uniforms: {
            boundarySpace: { value: simProps.boundarySpace }, velocity: { value: simProps.src.texture },
            px: { value: simProps.cellScale }, dt: { value: simProps.dt }
          }
        }, output: simProps.dst
      });
      this.init();
    }
    update(p) { this.uniforms.velocity.value = p.vel.texture; super.update(); }
  }

  /* ── Poisson ── */
  class Poisson extends ShaderPass {
    constructor(simProps) {
      super({
        material: {
          vertexShader: face_vert, fragmentShader: poisson_frag,
          uniforms: {
            boundarySpace: { value: simProps.boundarySpace }, pressure: { value: simProps.dst_.texture },
            divergence: { value: simProps.src.texture }, px: { value: simProps.cellScale }
          }
        }, output: simProps.dst, output0: simProps.dst_, output1: simProps.dst
      });
      this.init();
    }
    update(p) {
      let p_in, p_out;
      for (let i = 0; i < p.iterations; i++) {
        p_in = (i % 2 === 0) ? this.props.output0 : this.props.output1;
        p_out = (i % 2 === 0) ? this.props.output1 : this.props.output0;
        this.uniforms.pressure.value = p_in.texture;
        this.props.output = p_out;
        super.update();
      }
      return p_out;
    }
  }

  /* ── Pressure ── */
  class Pressure extends ShaderPass {
    constructor(simProps) {
      super({
        material: {
          vertexShader: face_vert, fragmentShader: pressure_frag,
          uniforms: {
            boundarySpace: { value: simProps.boundarySpace }, pressure: { value: simProps.src_p.texture },
            velocity: { value: simProps.src_v.texture }, px: { value: simProps.cellScale }, dt: { value: simProps.dt }
          }
        }, output: simProps.dst
      });
      this.init();
    }
    update(p) {
      this.uniforms.velocity.value = p.vel.texture;
      this.uniforms.pressure.value = p.pressure.texture;
      super.update();
    }
  }

  /* ── Simulation ── */
  class Simulation {
    constructor() {
      this.options = {
        iterations_poisson: CONFIG.iterationsPoisson, iterations_viscous: CONFIG.iterationsViscous,
        mouse_force: CONFIG.mouseForce, resolution: CONFIG.resolution, cursor_size: CONFIG.cursorSize,
        viscous: CONFIG.viscous, isBounce: CONFIG.isBounce, dt: CONFIG.dt,
        isViscous: CONFIG.isViscous, BFECC: CONFIG.BFECC
      };
      this.fbos = { vel_0: null, vel_1: null, vel_viscous0: null, vel_viscous1: null, div: null, pressure_0: null, pressure_1: null };
      this.fboSize = new THREE.Vector2();
      this.cellScale = new THREE.Vector2();
      this.boundarySpace = new THREE.Vector2();
      this.init();
    }
    init() {
      this.calcSize(); this.createAllFBO(); this.createShaderPass();
    }
    getFloatType() {
      return /(iPad|iPhone|iPod)/i.test(navigator.userAgent) ? THREE.HalfFloatType : THREE.FloatType;
    }
    createAllFBO() {
      const type = this.getFloatType();
      const opts = { type, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
      for (let key in this.fbos) this.fbos[key] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
    }
    createShaderPass() {
      this.advection = new Advection({ cellScale: this.cellScale, fboSize: this.fboSize, dt: this.options.dt, src: this.fbos.vel_0, dst: this.fbos.vel_1 });
      this.externalForce = new ExternalForce({ cellScale: this.cellScale, cursor_size: this.options.cursor_size, dst: this.fbos.vel_1 });
      this.viscous = new Viscous({ cellScale: this.cellScale, boundarySpace: this.boundarySpace, viscous: this.options.viscous, src: this.fbos.vel_1, dst: this.fbos.vel_viscous1, dst_: this.fbos.vel_viscous0, dt: this.options.dt });
      this.divergence = new Divergence({ cellScale: this.cellScale, boundarySpace: this.boundarySpace, src: this.fbos.vel_viscous0, dst: this.fbos.div, dt: this.options.dt });
      this.poisson = new Poisson({ cellScale: this.cellScale, boundarySpace: this.boundarySpace, src: this.fbos.div, dst: this.fbos.pressure_1, dst_: this.fbos.pressure_0 });
      this.pressure = new Pressure({ cellScale: this.cellScale, boundarySpace: this.boundarySpace, src_p: this.fbos.pressure_0, src_v: this.fbos.vel_viscous0, dst: this.fbos.vel_0, dt: this.options.dt });
    }
    calcSize() {
      const w = Math.max(1, Math.round(this.options.resolution * Common.width));
      const h = Math.max(1, Math.round(this.options.resolution * Common.height));
      this.cellScale.set(1 / w, 1 / h);
      this.fboSize.set(w, h);
    }
    resize() {
      this.calcSize();
      for (let key in this.fbos) this.fbos[key].setSize(this.fboSize.x, this.fboSize.y);
    }
    update() {
      if (this.options.isBounce) this.boundarySpace.set(0, 0); else this.boundarySpace.copy(this.cellScale);
      this.advection.update({ dt: this.options.dt, isBounce: this.options.isBounce, BFECC: this.options.BFECC });
      this.externalForce.update({ cursor_size: this.options.cursor_size, mouse_force: this.options.mouse_force, cellScale: this.cellScale });
      let vel = this.fbos.vel_1;
      if (this.options.isViscous) vel = this.viscous.update({ viscous: this.options.viscous, iterations: this.options.iterations_viscous, dt: this.options.dt });
      this.divergence.update({ vel });
      const pressure = this.poisson.update({ iterations: this.options.iterations_poisson });
      this.pressure.update({ vel, pressure });
    }
  }

  /* ── Output ── */
  class Output {
    constructor() {
      this.simulation = new Simulation();
      this.scene = new THREE.Scene();
      this.camera = new THREE.Camera();
      this.output = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.RawShaderMaterial({
          vertexShader: face_vert, fragmentShader: color_frag, transparent: true, depthWrite: false,
          uniforms: {
            velocity: { value: this.simulation.fbos.vel_0.texture },
            boundarySpace: { value: new THREE.Vector2() },
            palette: { value: paletteTex }, bgColor: { value: bgVec4 }
          }
        })
      );
      this.scene.add(this.output);
    }
    resize() { this.simulation.resize(); }
    render() {
      Common.renderer.setRenderTarget(null);
      Common.renderer.render(this.scene, this.camera);
    }
    update() { this.simulation.update(); this.render(); }
  }

  /* ── Main Manager ── */
  let rafId = null;
  let isVisible = true;

  function initLiquidEther() {
    const container = document.getElementById('liquid-ether-bg');
    if (!container) return;

    Common.init(container);
    Mouse.init(container);

    const manager = { lastUserInteraction: performance.now() };
    Mouse.onInteract = () => {
      manager.lastUserInteraction = performance.now();
      if (autoDriver) autoDriver.forceStop();
    };

    const autoDriver = new AutoDriver(Mouse, manager, {
      enabled: CONFIG.autoDemo, speed: CONFIG.autoSpeed,
      resumeDelay: CONFIG.autoResumeDelay, rampDuration: CONFIG.autoRampDuration
    });

    container.prepend(Common.renderer.domElement);
    const output = new Output();

    function loop() {
      autoDriver.update();
      Mouse.update();
      Common.update();
      output.update();
      rafId = requestAnimationFrame(loop);
    }

    function onResize() {
      Common.resize();
      output.resize();
    }

    window.addEventListener('resize', onResize);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (isVisible) {
        if (!rafId) loop();
      }
    });

    const io = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible && !document.hidden) { if (!rafId) loop(); }
      else { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
    }, { threshold: [0, 0.01, 0.1] });
    io.observe(container);

    loop();
  }

  /* ── Start on DOM ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiquidEther);
  } else {
    initLiquidEther();
  }
})();
