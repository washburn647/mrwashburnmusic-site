/* Sign lettering that always fits its sign, in every theme of every game. Any SVG <text> with
   data-fit="<width>" (in the sign's own units) that comes out wider than that is set smaller
   until it fits. Runs once the sign is on the page and again when the fonts have loaded. */
export function fitSigns(root) {
  const run = () => {
    if (!root.isConnected) return;
    root.querySelectorAll('text[data-fit]').forEach((t) => {
      const max = Number(t.dataset.fit);
      const size = Number(t.dataset.size ||= t.getAttribute('font-size') || parseFloat(getComputedStyle(t).fontSize));
      t.setAttribute('font-size', size);
      let w = 0;
      try { w = t.getComputedTextLength(); } catch { return; }
      if (w > max) t.setAttribute('font-size', (size * max / w * 0.98).toFixed(2));
    });
  };
  requestAnimationFrame(run);
  document.fonts?.ready.then(() => requestAnimationFrame(run));
}
