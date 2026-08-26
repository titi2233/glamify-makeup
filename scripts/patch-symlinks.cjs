const fs = require("fs");
const path = require("path");

const originalSymlinkSync = fs.symlinkSync;
const originalSymlink = fs.symlink;
const originalPromisesSymlink = fs.promises ? fs.promises.symlink : null;

function hasInvalidWindowsChars(str) {
  // Check if string contains virtual module identifiers like "cloudflare:sockets"
  if (!str) return false;
  // Ignore drive letters like C:\
  const withoutDrive = str.replace(/^[a-zA-Z]:[\\\/]/, "");
  return withoutDrive.includes(":") || withoutDrive.includes("*") || withoutDrive.includes("?");
}

function copyFallbackSync(target, destPath) {
  try {
    if (hasInvalidWindowsChars(target) || hasInvalidWindowsChars(destPath)) return;
    const resolvedTarget = path.isAbsolute(target)
      ? target
      : path.resolve(path.dirname(destPath), target);
    if (!fs.existsSync(resolvedTarget)) return;
    const stat = fs.statSync(resolvedTarget);
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      fs.cpSync(resolvedTarget, destPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(resolvedTarget, destPath);
    }
  } catch (e) {
    // ignore
  }
}

async function copyFallback(target, destPath, cb) {
  try {
    if (hasInvalidWindowsChars(target) || hasInvalidWindowsChars(destPath)) {
      if (cb) cb(null);
      return;
    }
    const resolvedTarget = path.isAbsolute(target)
      ? target
      : path.resolve(path.dirname(destPath), target);
    if (!fs.existsSync(resolvedTarget)) {
      if (cb) cb(null);
      return;
    }
    const stat = await fs.promises.stat(resolvedTarget);
    if (stat.isDirectory()) {
      await fs.promises.mkdir(destPath, { recursive: true });
      await fs.promises.cp(resolvedTarget, destPath, { recursive: true });
    } else {
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      await fs.promises.copyFile(resolvedTarget, destPath);
    }
    if (cb) cb(null);
  } catch (err) {
    if (cb) cb(err);
  }
}

fs.symlinkSync = function (target, destPath, type) {
  if (hasInvalidWindowsChars(target) || hasInvalidWindowsChars(destPath)) {
    return;
  }
  try {
    return originalSymlinkSync.call(fs, target, destPath, type || "junction");
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EACCES" || err.code === "EINVAL") {
      try {
        return originalSymlinkSync.call(fs, target, destPath, "junction");
      } catch (err2) {
        return copyFallbackSync(target, destPath);
      }
    }
    throw err;
  }
};

fs.symlink = function (target, destPath, type, callback) {
  const cb = typeof type === "function" ? type : callback;
  const actualType = typeof type === "string" ? type : "junction";

  if (hasInvalidWindowsChars(target) || hasInvalidWindowsChars(destPath)) {
    if (cb) cb(null);
    return;
  }

  originalSymlink.call(fs, target, destPath, actualType, (err) => {
    if (err && (err.code === "EPERM" || err.code === "EACCES" || err.code === "EINVAL")) {
      originalSymlink.call(fs, target, destPath, "junction", (err2) => {
        if (err2) {
          copyFallback(target, destPath, cb);
        } else if (cb) {
          cb(null);
        }
      });
    } else if (cb) {
      cb(err);
    }
  });
};

if (fs.promises && originalPromisesSymlink) {
  fs.promises.symlink = async function (target, destPath, type) {
    if (hasInvalidWindowsChars(target) || hasInvalidWindowsChars(destPath)) {
      return;
    }
    try {
      return await originalPromisesSymlink.call(fs.promises, target, destPath, type || "junction");
    } catch (err) {
      if (err.code === "EPERM" || err.code === "EACCES" || err.code === "EINVAL") {
        try {
          return await originalPromisesSymlink.call(fs.promises, target, destPath, "junction");
        } catch (err2) {
          return copyFallback(target, destPath);
        }
      } else {
        throw err;
      }
    }
  };
}
