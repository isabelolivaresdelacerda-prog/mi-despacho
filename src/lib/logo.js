// Recorta los márgenes blancos o transparentes del logo, para que se vea grande.
export function recortarLogo(dataURL) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0);
        const { data, width: w, height: h } = x.getImageData(0, 0, c.width, c.height);
        const fondo = (i) => data[i + 3] < 16 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240);
        let t = h, b = -1, l = w, r = -1;
        for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
          if (!fondo((y * w + xx) * 4)) { if (y < t) t = y; if (y > b) b = y; if (xx < l) l = xx; if (xx > r) r = xx; }
        }
        if (r < 0) return ok(dataURL);
        const m = Math.round(Math.max(r - l, b - t) * 0.02);
        l = Math.max(0, l - m); t = Math.max(0, t - m); r = Math.min(w - 1, r + m); b = Math.min(h - 1, b + m);
        const o = document.createElement("canvas");
        o.width = r - l + 1; o.height = b - t + 1;
        o.getContext("2d").drawImage(c, l, t, o.width, o.height, 0, 0, o.width, o.height);
        ok(o.toDataURL("image/png"));
      } catch { ok(dataURL); }
    };
    img.onerror = () => ok(dataURL);
    img.src = dataURL;
  });
}
