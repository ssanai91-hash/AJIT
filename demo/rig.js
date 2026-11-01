/* Coordinates stay in the original bust's pixel space. Expressions replace
 * facial features, never the hair, ears, jaw silhouette, neck or sweater. */
(() => {
  'use strict';
  let serial = 0;
  const data = window.AJIT_RIG_DATA;
  const pointMap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  function similarity(from, to) {
    const ux = from[1][0] - from[0][0], uy = from[1][1] - from[0][1];
    const vx = to[1][0] - to[0][0], vy = to[1][1] - to[0][1];
    const den = ux * ux + uy * uy;
    const a = (vx * ux + vy * uy) / den, b = (vy * ux - vx * uy) / den;
    return [a, b, -b, a, to[0][0] - a * from[0][0] + b * from[0][1], to[0][1] - b * from[0][0] - a * from[0][1]];
  }
  function affine(from, to) {
    const [p, q, r] = from;
    const ux = q[0] - p[0], uy = q[1] - p[1], vx = r[0] - p[0], vy = r[1] - p[1];
    const det = ux * vy - uy * vx;
    const tx = to[1][0] - to[0][0], ty = to[1][1] - to[0][1];
    const mx = to[2][0] - to[0][0], my = to[2][1] - to[0][1];
    const a = (tx * vy - mx * uy) / det, c = (mx * ux - tx * vx) / det;
    const b = (ty * vy - my * uy) / det, d = (my * ux - ty * vx) / det;
    return [a, b, c, d, to[0][0] - a * p[0] - c * p[1], to[0][1] - b * p[0] - d * p[1]];
  }
  const matrix = m => `matrix(${m.map(x => Number(x.toFixed(6))).join(' ')})`;
  function markup(n, label = '', base = 'img/') {
    const r = data[n], key = `rig-${++serial}`;
    const [left, right, mouth] = r.landmarks;
    const cx = (left[0] + right[0]) / 2, cy = (left[1] + right[1]) / 2;
    const d = Math.hypot(right[0] - left[0], right[1] - left[1]);
    const angle = Math.atan2(right[1] - left[1], right[0] - left[0]) * 180 / Math.PI;
    const poses = Object.entries(r.poses).map(([pose, p]) => {
      const m = pose === 'rest' ? [1, 0, 0, 1, 0, 0] : similarity(p.landmarks, r.landmarks);
      return `<g data-pose="${pose}"${pose === 'rest' ? ' class="on"' : ''}><image href="${base + p.file}" width="${p.width}" height="${p.height}" transform="${matrix(m)}"/></g>`;
    }).join('');
    return `<svg class="character-rig" data-rig="${n}" viewBox="0 0 ${r.width} ${r.height}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="${key}-feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
      <mask id="${key}-features" maskUnits="userSpaceOnUse" x="0" y="0" width="${r.width}" height="${r.height}">
        <g fill="white" filter="url(#${key}-feather)">
          <ellipse cx="${cx}" cy="${cy}" rx="${d * 1.14}" ry="${d * (n === 3 ? .38 : .64)}" transform="rotate(${angle} ${cx} ${cy})"/>
          <ellipse cx="${mouth[0]}" cy="${mouth[1]}" rx="${d * .83}" ry="${d * .48}" transform="rotate(${angle} ${mouth[0]} ${mouth[1]})"/>
        </g></mask></defs>
      ${poses}<g class="face" mask="url(#${key}-features)"><image data-feature-image=""/></g>
    </svg>`;
  }
  function setExpression(root, emo, visible = true, base = 'img/') {
    const svg = root.matches?.('[data-rig]') ? root : root.querySelector('[data-rig]');
    if (!svg) return;
    const r = data[svg.dataset.rig], face = svg.querySelector('.face');
    const p = r.expressions[emo];
    face.classList.toggle('on', visible && emo !== 'neutral' && !!p);
    if (!p || emo === 'neutral') return;
    const im = face.querySelector('image');
    im.setAttribute('href', base + p.file);
    im.setAttribute('width', p.width); im.setAttribute('height', p.height);
    im.setAttribute('transform', matrix(affine(p.landmarks, r.landmarks)));
  }
  window.AjitRig = { markup, setExpression, data, affine, similarity, pointMap };
})();
