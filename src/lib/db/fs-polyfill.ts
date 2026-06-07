import fs from 'node:fs';

// @ts-ignore
if (typeof fs.readdir === 'undefined' || fs.readdir.name === 'unenv') {
  // @ts-ignore
  fs.readdir = function (path, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(null, []);
  };
  // @ts-ignore
  fs.readdirSync = function () {
    return [];
  };
}
