// Prepare call requests for the visitor's email app and a matching text download.
(() => {
  'use strict';
  const form = document.getElementById('booking-form');
  if (!form) return;
  // Keep step navigation local; the visitor sends the request in their email app.
  form.addEventListener('submit', event => {
    event.preventDefault();
    advance();
  });
  const fieldset = document.getElementById('booking-fields');
  const steps = [...document.querySelectorAll('[data-step]')];
  const progress = [...document.querySelectorAll('[data-progress]')];
  const status = document.getElementById('request-status');
  const emailRequest = document.getElementById('email-request');
  const emailHint = document.getElementById('email-request-hint');
  const preparedEmailHint = emailHint.textContent;
  const requestRecipient = 'customer@neko-cwc.com';
  const requestSubject = 'NCUHOME LLC call request';
  const download = document.getElementById('download-request');
  const recovery = document.getElementById('download-recovery');
  const locale = navigator.languages?.[0] || navigator.language || document.documentElement.lang || 'en';
  const fields = {
    project: document.getElementById('project-type'),
    date: document.getElementById('preferred-date'),
    time: document.getElementById('preferred-time'),
    zone: document.getElementById('time-zone'),
    name: document.getElementById('request-name'),
    email: document.getElementById('request-email'),
    company: document.getElementById('request-company'),
    context: document.getElementById('request-context')
  };
  const projectLabels = { website: 'Website', software: 'Custom software', design: 'Product design' };
  const originalHelp = new Map(Object.values(fields).map(field => [field, field.getAttribute('aria-describedby') || '']));
  let currentStep = 1;
  let fileUrl = null;
  let emailIncludesDetails = false;

  function validZone(zone) {
    try { new Intl.DateTimeFormat(locale, { timeZone: zone }).format(); return true; }
    catch { return false; }
  }
  function todayInZone() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: fields.zone.value || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function updateDateMinimum() {
    const tomorrow = new Date(`${todayInZone()}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    fields.date.min = tomorrow.toISOString().slice(0, 10);
    document.getElementById('zone-hint').textContent = `Times are in ${fields.zone.value}.`;
  }
  function formatDate(value) {
    // Date-only values are kept as calendar dates, never converted across zones.
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T12:00:00Z`));
  }
  function formatTime(value) {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric', minute: '2-digit', timeZone: 'UTC'
    }).format(new Date(`2000-01-01T${value}:00Z`));
  }
  function messageFor(field) {
    const value = field.value.trim();
    if (field === fields.project && !Object.hasOwn(projectLabels, value)) return 'Choose a project type.';
    if (field === fields.zone && !validZone(value)) return 'Choose a time zone from the list.';
    if (field === fields.date) {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || field.validity.badInput) return 'Choose a future date.';
      if (value <= todayInZone()) return `Choose a date after ${formatDate(todayInZone())}.`;
      if (field.validity.rangeOverflow) return 'Choose a date before the year 10000.';
    }
    if (field === fields.time && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value) || field.validity.badInput)) return 'Enter a preferred time, including the hour and minute.';
    if (field === fields.name && !value) return 'Enter your name.';
    if (field === fields.email && (!value || field.validity.typeMismatch || /\s/.test(value))) return 'Enter an email address, such as name@example.com.';
    if (field.maxLength > 0 && value.length > field.maxLength) return `Use ${field.maxLength} characters or fewer.`;
    return '';
  }
  function setError(field, message) {
    const error = document.getElementById(`${field.id}-error`);
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', [originalHelp.get(field), error.id].filter(Boolean).join(' '));
    } else {
      field.removeAttribute('aria-invalid');
      if (originalHelp.get(field)) field.setAttribute('aria-describedby', originalHelp.get(field));
      else field.removeAttribute('aria-describedby');
    }
  }
  function validate(group) {
    let firstInvalid = null;
    for (const field of group) {
      // Normalize only surrounding whitespace; the same values feed email and file.
      if (['text', 'email'].includes(field.type) || field.tagName === 'TEXTAREA') field.value = field.value.trim();
      const message = messageFor(field);
      setError(field, message);
      if (message && !firstInvalid) firstInvalid = field;
    }
    return firstInvalid;
  }
  function showStep(next, focus = true) {
    currentStep = next;
    steps.forEach(step => { step.hidden = Number(step.dataset.step) !== next; });
    form.hidden = next === 3;
    progress.forEach(item => {
      if (Number(item.dataset.progress) === next) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    status.textContent = '';
    // No entrance delay on routine step changes; focus and visible labels are immediate.
    if (focus) steps.find(step => Number(step.dataset.step) === next).querySelector('h3').focus();
  }
  function revokeFile() {
    if (fileUrl) {
      try { URL.revokeObjectURL(fileUrl); } catch { /* Email and copy remain usable. */ }
    }
    fileUrl = null;
    download.removeAttribute('href');
  }
  function data() {
    return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
  }
  function prepareReview() {
    const value = data();
    const text = (id, content) => { document.getElementById(id).textContent = content; };
    text('review-project', projectLabels[value.project]);
    text('review-date', formatDate(value.date));
    document.getElementById('review-date').dateTime = value.date;
    text('review-time', formatTime(value.time));
    text('review-zone', value.zone);
    text('review-name', value.name);
    text('review-email', value.email);
    text('review-company', value.company || 'Not added');
    text('review-context', value.context || 'Not added');
    const requestText = [
      'NCUHOME LLC — Call request',
      `Email this request to ${requestRecipient}. Our team will reply by email to confirm a time.`,
      '',
      `Project: ${projectLabels[value.project]}`,
      `Preferred date: ${formatDate(value.date)} (${value.date})`,
      `Preferred time: ${formatTime(value.time)} (${value.time})`,
      `Time zone: ${value.zone}`,
      '',
      `Name: ${value.name}`,
      `Email: ${value.email}`,
      `Company: ${value.company || 'Not added'}`,
      '',
      'Project context:',
      value.context || 'Not added',
      ''
    ].join('\n');
    text('request-text', requestText);
    revokeFile();
    recovery.hidden = false;
    recovery.open = false;
    emailRequest.href = `mailto:${requestRecipient}`;
    emailHint.textContent = preparedEmailHint;
    emailIncludesDetails = false;
    const notices = [];
    try {
      // All entered values belong to one encoded body. Recipient and subject are fixed;
      // newlines, ampersands, and header-like text can never become mail headers or HTML.
      emailRequest.href = `mailto:${requestRecipient}?subject=${encodeURIComponent(requestSubject)}&body=${encodeURIComponent(requestText)}`;
      emailIncludesDetails = true;
    } catch {
      recovery.open = true;
      emailHint.textContent = `Opens your email app. Copy the complete request text below into your message to ${requestRecipient}.`;
      notices.push(`Copy the request text below and email it to ${requestRecipient}. Our team will reply to confirm a time.`);
    }
    download.hidden = false;
    download.parentElement.hidden = false;
    try {
      fileUrl = URL.createObjectURL(new Blob([requestText], { type: 'text/plain;charset=utf-8' }));
      download.href = fileUrl;
      download.download = `ncuhome-call-request-${value.date}.txt`;
    } catch {
      download.hidden = true;
      download.parentElement.hidden = true;
      recovery.open = true;
      notices.push(`The download is unavailable. Use Send request by email, or copy the text below and email it to ${requestRecipient}.`);
    }
    showStep(3);
    status.textContent = notices.join(' ');
  }
  function advance() {
    if (currentStep === 3) return;
    updateDateMinimum();
    const projectFields = [fields.project, fields.date, fields.time, fields.zone];
    const firstProjectError = validate(projectFields);
    if (firstProjectError) {
      if (currentStep !== 1) showStep(1, false);
      firstProjectError.focus();
      return;
    }
    if (currentStep === 1) {
      document.getElementById('preference-summary').textContent = `${projectLabels[fields.project.value]} · ${formatDate(fields.date.value)} · ${formatTime(fields.time.value)} · ${fields.zone.value}`;
      showStep(2);
      return;
    }
    const firstDetailsError = validate([fields.name, fields.email, fields.company, fields.context]);
    if (firstDetailsError) { firstDetailsError.focus(); return; }
    prepareReview();
  }
  function edit(step) {
    revokeFile();
    emailRequest.href = `mailto:${requestRecipient}`;
    emailIncludesDetails = false;
    showStep(step);
  }

  // Native select, explicit zone, with the browser's detected zone as an editable default.
  let detected = 'UTC';
  try { detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* UTC remains explicit. */ }
  const fallbackZones = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
  let zones = fallbackZones;
  try { if (Intl.supportedValuesOf) zones = Intl.supportedValuesOf('timeZone'); } catch { /* Useful native list remains. */ }
  fields.zone.replaceChildren();
  for (const zone of [...new Set([detected, 'UTC', ...zones])].filter(validZone)) {
    const option = document.createElement('option');
    option.value = zone;
    option.textContent = zone.replaceAll('_', ' ');
    fields.zone.append(option);
  }
  fields.zone.value = validZone(detected) ? detected : 'UTC';
  updateDateMinimum();
  fields.zone.addEventListener('change', () => {
    updateDateMinimum();
    if (fields.date.hasAttribute('aria-invalid')) setError(fields.date, messageFor(fields.date));
  });
  Object.values(fields).forEach(field => {
    for (const eventName of ['input', 'change']) field.addEventListener(eventName, () => {
      if (field.hasAttribute('aria-invalid')) setError(field, messageFor(field));
    });
  });
  document.getElementById('booking-back').addEventListener('click', () => showStep(1));
  document.getElementById('edit-project').addEventListener('click', () => edit(1));
  document.getElementById('edit-details').addEventListener('click', () => edit(2));
  emailRequest.addEventListener('click', () => {
    status.textContent = emailIncludesDetails
      ? 'Finish sending the request in your email app. Our team will reply by email to confirm a time.'
      : `Copy the request text into your email to ${requestRecipient} and send it there. Our team will reply to confirm a time.`;
  });
  download.addEventListener('click', () => {
    status.textContent = `Your request file is ready. You can email it to ${requestRecipient}; our team will reply to confirm a time.`;
  });
  document.querySelectorAll('a[href="#book-call"]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      // Keep native anchor/hash behavior and focus the current input step afterward.
      requestAnimationFrame(() => steps.find(step => Number(step.dataset.step) === currentStep).querySelector('h3').focus({ preventScroll: true }));
    });
  });
  window.addEventListener('pagehide', revokeFile);
  // A page restored from the back-forward cache needs a fresh local download URL.
  window.addEventListener('pageshow', event => { if (event.persisted && currentStep === 3) prepareReview(); });
  fieldset.disabled = false;
  form.dataset.ready = 'true';
})();

// Keep the native primary contact link useful even if config is absent or invalid.
(() => {
  'use strict';
  const destination = window.NCUHOME_CONFIG?.contactDestination;
  function validContact(value) {
    if (typeof value !== 'string' || !value || /\s|[\u0000-\u001f\u007f]/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return url.href;
      if (url.protocol === 'mailto:' && !url.search && !url.hash && /^[^@<>:,;]+@[^@<>:,;]+\.[^@<>:,;]+$/.test(url.pathname)) return url.href;
    } catch { /* Empty/invalid owner config leaves booking as the next step. */ }
    return null;
  }
  const contact = validContact(destination);
  if (contact) {
    const link = document.getElementById('contact-link');
    link.href = contact;
    link.hidden = false;
  }
})();

(() => {
  'use strict';
  // A reveal is an enhancement, never a visibility prerequisite.
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealing');
      observer.unobserve(entry.target);
    });
  }, { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
})();

(() => {
  'use strict';
  const canvas = document.getElementById('form-canvas');
  const fallback = document.querySelector('.form-fallback');
  const path = document.getElementById('form-path');
  const replay = document.getElementById('resolve');
  const reset = document.getElementById('reset');
  const status = document.getElementById('form-status');
  const controls = document.getElementById('object-controls');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const style = getComputedStyle(document.documentElement);
  const duration = (name, fallbackDuration) => parseFloat(style.getPropertyValue(name)) || fallbackDuration;
  const resolveDuration = duration('--motion-resolve', 2000);
  const resetDuration = duration('--motion-reset', 800);
  const openingDuration = duration('--motion-opening', 2600);
  let amount = 0, target = 1, frame = 0, context = null;
  let width = 600, height = 500;
  const tau = Math.PI * 2;

  // The same original Form geometry is projected into SVG and optional Canvas 2D.
  // No WebGL feature test, GPU context, or renderer owns the controls or state.
  function point(u, v, state, tubeScale = 1) {
    const ambiguity = 1 - state, cu = Math.cos(u), su = Math.sin(u);
    const radius = .94 / Math.pow(cu ** 4 + su ** 4, .25);
    const distort = ambiguity * (.16 * Math.sin(u * 3 + .4) + .08 * Math.cos(u * 5));
    const tube = (.205 + ambiguity * .055 * Math.sin(u * 2)) * tubeScale;
    const twist = ambiguity * (.9 * Math.sin(u * 2 - .6) + .3 * Math.cos(u * 3));
    const x = (radius + distort + tube * Math.cos(v + twist)) * cu;
    const y = (radius + distort + tube * Math.cos(v + twist)) * su;
    const z = tube * Math.sin(v + twist) + ambiguity * (.37 * Math.sin(u * 2 + .2) + .15 * Math.cos(u * 3));
    const angle = -.38 + ambiguity * .09;
    const rx = x * Math.cos(angle) - y * Math.sin(angle), ry = x * Math.sin(angle) + y * Math.cos(angle);
    const py = ry * Math.cos(.76) - z * Math.sin(.76), pz = ry * Math.sin(.76) + z * Math.cos(.76);
    return [rx * Math.cos(-.27) + pz * Math.sin(-.27), py, -rx * Math.sin(-.27) + pz * Math.cos(-.27)];
  }
  function project(p, w, h) {
    const perspective = 4.8 / (4.8 - p[2]);
    const scale = Math.min(w * .34, h * .4);
    return [w / 2 + p[0] * scale * perspective, h * .47 + p[1] * scale * perspective, p[2]];
  }
  function drawSVG() {
    const points = [];
    for (let i = 0; i < 96; i++) {
      const p = project(point(i / 96 * tau, 0, amount, 0), 600, 500);
      points.push(`${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`);
    }
    path.setAttribute('d', `${points.join(' ')} Z`);
  }
  let bitmap = null, depth = null;
  function drawSurface() {
    // Smooth vertex shading in a tiny software rasterizer. Canvas 2D only presents
    // pixels; it never needs a graphics driver or leaves mesh seams in the artwork.
    const w = canvas.width, h = canvas.height;
    if (!bitmap || bitmap.width !== w || bitmap.height !== h) {
      bitmap = context.createImageData(w, h);
      depth = new Float32Array(w * h);
    }
    bitmap.data.fill(0);
    depth.fill(-Infinity);
    const pixels = bitmap.data, densityX = w / width, densityY = h / height;
    const segments = 120, sides = 40, stride = sides + 1, vertices = [];
    function shade(n) {
      const diffuse = Math.max(0, n[0] * -.45 + n[1] * -.65 + n[2] * .61);
      const fill = Math.max(0, n[0] * .75 + n[1] * .28 + n[2] * .6);
      const shine = Math.pow(Math.max(0, n[0] * -.15 + n[1] * -.26 + n[2] * .95), 42);
      const rim = Math.pow(1 - Math.abs(n[2]), 3);
      return [.19, .205, .175].map((base, index) => Math.min(1, base + diffuse * [.54, .55, .52][index] + fill * .09 + shine * .24 + rim * .055) * 255);
    }
    for (let i = 0; i <= segments; i++) for (let j = 0; j <= sides; j++) {
      const u = i / segments * tau, v = j / sides * tau;
      const p = point(u, v, amount), a = point(u + .001, v, amount), b = point(u, v + .001, amount);
      const ax = a[0] - p[0], ay = a[1] - p[1], az = a[2] - p[2];
      const bx = b[0] - p[0], by = b[1] - p[1], bz = b[2] - p[2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const norm = Math.hypot(nx, ny, nz) || 1;
      const n = [nx / norm, ny / norm, nz / norm], screen = project(p, width, height);
      vertices.push({ x: screen[0] * densityX, y: screen[1] * densityY, z: screen[2], n, c: shade(n) });
    }
    function triangle(a, b, c) {
      if (a.n[2] + b.n[2] + c.n[2] < -.3) return;
      const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(area) < .001) return;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      const inv = 1 / area;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + .5, py = y + .5;
        const first = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
        const second = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
        const third = 1 - first - second;
        if (first < 0 || second < 0 || third < 0) continue;
        const index = y * w + x, z = first * a.z + second * b.z + third * c.z;
        if (z <= depth[index]) continue;
        depth[index] = z;
        const offset = index * 4;
        for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = first * a.c[channel] + second * b.c[channel] + third * c.c[channel];
        pixels[offset + 3] = 255;
      }
    }
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i * stride + j, b = a + stride;
      triangle(vertices[a], vertices[b], vertices[a + 1]);
      triangle(vertices[b], vertices[b + 1], vertices[a + 1]);
    }
    context.putImageData(bitmap, 0, 0);
  }
  function draw() {
    drawSVG();
    if (!context) return;
    try {
      drawSurface();
      canvas.hidden = false;
      fallback.setAttribute('hidden', '');
    } catch {
      // Keep a working native SVG when any optional surface operation fails.
      context = null;
      canvas.hidden = true;
      fallback.removeAttribute('hidden');
    }
  }
  function settled() {
    status.textContent = target ? 'Form resolved. Every part considered.' : 'A possibility, ready to take shape.';
    if (!target && document.activeElement === reset) replay.focus({ preventScroll: true });
    reset.disabled = !target;
    controls.dataset.state = target ? 'resolved' : 'possibility';
  }
  function animate(sequence, finalTarget) {
    cancelAnimationFrame(frame);
    frame = 0;
    target = finalTarget;
    reset.disabled = false;
    controls.dataset.state = finalTarget ? 'resolving' : 'resetting';
    if (reducedMotion.matches) { amount = target; draw(); settled(); return; }
    status.textContent = finalTarget ? 'Taking shape…' : 'Returning to possibility…';
    const start = performance.now(), initial = amount;
    function tick(now) {
      let elapsed = now - start, from = initial;
      for (const segment of sequence) {
        if (elapsed <= segment.duration) {
          const t = Math.max(0, Math.min(elapsed / segment.duration, 1));
          const eased = t < .5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
          amount = from + (segment.to - from) * eased;
          draw();
          frame = requestAnimationFrame(tick);
          return;
        }
        elapsed -= segment.duration;
        from = segment.to;
      }
      frame = 0;
      amount = target;
      draw();
      settled();
    }
    frame = requestAnimationFrame(tick);
  }
  function setState(next) {
    if (next !== 0 && next !== 1) return;
    animate([{ to: next, duration: next ? resolveDuration : resetDuration }], next);
  }
  function replayMotion() {
    animate([{ to: 0, duration: Math.max(1, openingDuration - resolveDuration) }, { to: 1, duration: resolveDuration }], 1);
  }
  replay.addEventListener('click', replayMotion);
  reset.addEventListener('click', () => setState(0));
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    cancelAnimationFrame(frame);
    frame = 0;
    amount = target;
    draw();
    settled();
  });
  // Core state and controls are ready before requesting the optional 2D context.
  controls.hidden = false;
  window.ncuForm = { setState, replay: replayMotion, getState: () => ({ amount, target, running: Boolean(frame), reducedMotion: reducedMotion.matches, renderer: context ? 'canvas2d' : 'svg' }) };
  try { context = canvas.getContext('2d', { alpha: true }); } catch { /* SVG stays active. */ }
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width;
    height = rect.height;
    if (context) {
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      try { context.setTransform(density, 0, 0, density, 0, 0); }
      catch { context = null; canvas.hidden = true; fallback.removeAttribute('hidden'); }
    }
    draw();
  }
  canvas.addEventListener('contextlost', () => {
    context = null;
    canvas.hidden = true;
    fallback.removeAttribute('hidden');
    drawSVG();
  });
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener('resize', resize);
  // Reduced motion opens in its final still state; it never starts autoplay.
  if (reducedMotion.matches) { amount = target = 1; draw(); settled(); }
  else replayMotion();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    amount = target;
    draw();
    settled();
  });
  window.__ready = true;
})();
