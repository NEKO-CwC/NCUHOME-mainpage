(() => {
  'use strict';
  const destination = window.NCUHOME_CONFIG?.contactDestination;
  function validContact(value) {
    if (typeof value !== 'string' || !value || /\s|[\u0000-\u001f\u007f]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return url.href;
      if (url.protocol === 'mailto:' && !url.search && !url.hash && /^[^@<>:,;]+@[^@<>:,;]+\.[^@<>:,;]+$/.test(url.pathname)) return url.href;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    return null;
  }
  const contact = validContact(destination);
  if (contact) {
    const link = document.getElementById('contact-link');
    link.href = contact;
    link.hidden = false;
    document.getElementById('contact-status').textContent = contact.startsWith('mailto:') ? 'Start with a question. Your email app will open.' : 'Start with a question. Continue to our contact page.';
  }

  const canvas = document.getElementById('form-canvas');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return; // Static SVG and complete HTML remain available.
  const vertexSource = `attribute vec3 position; attribute vec3 normal;
    uniform vec2 scale; varying vec3 vNormal; varying vec3 vPosition;
    void main(){ float perspective=4.8/(4.8-position.z);
      gl_Position=vec4(position.x*scale.x*perspective,-position.y*scale.y*perspective+.05,-position.z*.2,1.0);
      vNormal=normal; vPosition=position; }`;
  const fragmentSource = `precision mediump float; varying vec3 vNormal; varying vec3 vPosition;
    void main(){ vec3 n=normalize(vNormal); vec3 light=normalize(vec3(-.45,-.65,1.));
      float diffuse=max(dot(n,light),0.); float rim=pow(1.-abs(n.z),3.);
      float shine=pow(max(dot(n,normalize(vec3(-.25,-.45,1.6))),0.),42.);
      float fill=max(dot(n,normalize(vec3(.8,.3,.6))),0.);
      vec3 color=vec3(.19,.205,.175)+diffuse*vec3(.54,.55,.52)+fill*.09+shine*.24+rim*.055;
      gl_FragColor=vec4(color,1.); }`;
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      console.warn('Form renderer unavailable:', gl.getShaderInfoLog(result));
      gl.deleteShader(result); return null;
    }
    return result;
  }
  const vertex = shader(gl.VERTEX_SHADER, vertexSource), fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Form renderer unavailable:', gl.getProgramInfoLog(program)); return;
  }
  gl.useProgram(program); gl.enable(gl.DEPTH_TEST);
  const segments = 144, sides = 48, stride = sides + 1;
  const vertices = new Float32Array((segments + 1) * stride * 6);
  const indices = new Uint16Array(segments * sides * 6);
  let cursor = 0;
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    const a = i * stride + j, b = a + stride;
    indices.set([a,b,a+1,b,b+1,a+1], cursor); cursor += 6;
  }
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, offset] of [['position',0],['normal',12]]) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset);
  }
  const indexBuffer = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const scaleLocation = gl.getUniformLocation(program,'scale');
  const resolve = document.getElementById('resolve'), reset = document.getElementById('reset');
  const status = document.getElementById('form-status'), controls = document.getElementById('object-controls');
  const fallback = document.querySelector('.form-fallback');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tokens = getComputedStyle(document.documentElement);
  const durations = { 0: parseFloat(tokens.getPropertyValue('--motion-reset')), 1: parseFloat(tokens.getPropertyValue('--motion-resolve')) };
  if (!Object.values(durations).every(value => Number.isFinite(value) && value >= 0)) {
    console.warn('Form motion tokens are missing or invalid. Static form retained.'); return;
  }
  let amount = 0, target = 0, frame = 0, width = 0, height = 0;
  const tau = Math.PI * 2;
  function point(u,v,state) {
    const ambiguity=1-state, cu=Math.cos(u), su=Math.sin(u);
    const radius=.94/Math.pow(cu**4+su**4,.25);
    const distort=ambiguity*(.16*Math.sin(u*3+.4)+.08*Math.cos(u*5));
    const tube=.205+ambiguity*.055*Math.sin(u*2);
    const twist=ambiguity*(.9*Math.sin(u*2-.6)+.3*Math.cos(u*3));
    const x=(radius+distort+tube*Math.cos(v+twist))*cu;
    const y=(radius+distort+tube*Math.cos(v+twist))*su;
    const z=tube*Math.sin(v+twist)+ambiguity*(.37*Math.sin(u*2+.2)+.15*Math.cos(u*3));
    const angle=-.38+ambiguity*.09;
    const rx=x*Math.cos(angle)-y*Math.sin(angle), ry=x*Math.sin(angle)+y*Math.cos(angle);
    const py=ry*Math.cos(.76)-z*Math.sin(.76), pz=ry*Math.sin(.76)+z*Math.cos(.76);
    return [rx*Math.cos(-.27)+pz*Math.sin(-.27),py,-rx*Math.sin(-.27)+pz*Math.cos(-.27)];
  }
  function draw() {
    let offset=0;
    for(let i=0;i<=segments;i++) for(let j=0;j<=sides;j++) {
      const u=i/segments*tau,v=j/sides*tau;
      const p=point(u,v,amount),a=point(u+.001,v,amount),b=point(u,v+.001,amount);
      const ax=a[0]-p[0],ay=a[1]-p[1],az=a[2]-p[2],bx=b[0]-p[0],by=b[1]-p[1],bz=b[2]-p[2];
      // Tangent cross product gives outward smooth surface normals.
      const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx, norm=Math.hypot(nx,ny,nz);
      vertices.set([p[0],p[1],p[2],nx/norm,ny/norm,nz/norm],offset); offset+=6;
    }
    gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const scale=Math.min(width*.34,height*.39);
    gl.uniform2f(scaleLocation,scale*2/width,scale*2/height);
    gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
  }
  function resize() {
    const rect=canvas.parentElement.getBoundingClientRect(); width=rect.width; height=rect.height;
    if (!width || !height) return;
    const density=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*density); canvas.height=Math.round(height*density);
    gl.viewport(0,0,canvas.width,canvas.height); draw();
  }
  function announce() {
    resolve.textContent=target?'Form resolved':'Give it form';
    status.textContent=target?'A continuous form. Every part considered.':'A possibility, waiting to take shape.';
  }
  function easeInOutQuint(progress) {
    return progress < .5 ? 16 * progress ** 5 : 1 - (-2 * progress + 2) ** 5 / 2;
  }
  function setState(next) {
    if (next!==0 && next!==1) return;
    cancelAnimationFrame(frame); frame=0; target=next;
    resolve.setAttribute('aria-pressed',String(Boolean(next))); resolve.textContent=next?'Giving it form…':'Give it form';
    if (!next && document.activeElement === reset) resolve.focus({ preventScroll: true });
    reset.disabled=!next;
    if(reducedMotion.matches || durations[next]===0) { amount=next; draw(); announce(); return; }
    status.textContent=next?'Giving the idea form…':'Returning to possibility…';
    const from=amount,start=performance.now();
    function tick(now) {
      const t=Math.min((now-start)/durations[next],1),eased=easeInOutQuint(t);
      amount=from+(next-from)*eased; draw();
      if(t<1) frame=requestAnimationFrame(tick); else { frame=0; amount=next; announce(); }
    }
    frame=requestAnimationFrame(tick);
  }
  resolve.addEventListener('click',()=>{if(target!==1)setState(1);});
  reset.addEventListener('click',()=>setState(0));
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){cancelAnimationFrame(frame);frame=0;amount=target;draw();announce();}});
  canvas.addEventListener('webglcontextlost',()=>{
    cancelAnimationFrame(frame); frame=0; canvas.hidden=true; fallback.removeAttribute('hidden'); controls.hidden=true;
  });
  canvas.hidden=false; resize(); fallback.setAttribute('hidden',''); controls.hidden=false;
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener('resize',resize);
  window.ncuForm={setState,getState:()=>({amount,target,running:Boolean(frame),reducedMotion:reducedMotion.matches})};
  window.__ready=true;
})();
