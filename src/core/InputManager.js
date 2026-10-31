// Input: mouse aim + fire, keyboard (R reload, ESC/P pause). Tracks edges for one-shot actions.
export class InputManager {
  constructor() {
    this.mouse = { x: 0, y: 0 };       // pixel coords
    this.ndc = { x: 0, y: 0 };          // normalized device coords (-1..1)
    this.firing = false;                 // held down
    this.firePressed = false;            // edge (consumed by player each frame)
    this.reloadPressed = false;
    this.pausePressed = false;
    this.anyKeyPressed = false;
    this.onKeyDown = null;               // callback for menu navigation
    this._handlers = [];
  }

  attach(el) {
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.ndc.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onDown = (e) => {
      if (e.button === 0) {
        this.firing = true;
        this.firePressed = true;
      }
    };
    const onUp = (e) => { if (e.button === 0) this.firing = false; };
    const onCtx = (e) => e.preventDefault();
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      this.anyKeyPressed = true;
      if (k === 'r') this.reloadPressed = true;
      if (k === 'escape' || k === 'p') this.pausePressed = true;
      if (this.onKeyDown) this.onKeyDown(e);
    };
    const onBlur = () => { this.firing = false; };

    window.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('contextmenu', onCtx);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    this._handlers = [
      ['mousemove', onMove], ['mousedown', onDown], ['mouseup', onUp],
      ['contextmenu', onCtx], ['keydown', onKey], ['blur', onBlur]
    ];
  }

  detach() {
    for (const [ev, fn] of this._handlers) window.removeEventListener(ev, fn);
    this._handlers = [];
    this.firing = false;
  }

  // Call at end of each frame to clear edge flags.
  endFrame() {
    this.firePressed = false;
    this.reloadPressed = false;
    this.pausePressed = false;
  }
}
