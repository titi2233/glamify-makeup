import fs from 'node:fs';

if (typeof fs.readdir === 'undefined' || fs.readdir.name === 'unenv') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fs as any).readdir = function (path: unknown, options: unknown, callback: unknown) {
    const cb = typeof options === 'function' ? options : callback;
    if (typeof cb === 'function') cb(null, []);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fs as any).readdirSync = function () {
    return [];
  };
}
