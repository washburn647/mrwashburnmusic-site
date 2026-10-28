/* Small DOM builder. Text always goes in as text, never as HTML. */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

export function grow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/* A delete button that asks once more before it acts. */
export function confirmButton(label, sure, action) {
  let timer = null;
  const btn = h('button', { class: 'danger', onclick: () => {
    if (btn.dataset.armed) { clearTimeout(timer); action(); return; }
    btn.dataset.armed = '1';
    btn.textContent = sure;
    timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 3000);
  } }, label);
  return btn;
}
