import Gio from "gi://Gio";
import GLib from "gi://GLib";

const EXCLUDED_PORTS = [5353, 631, 53];
let _uidMap = null;

export function exportClearCache() {
  _uidMap = null;
}

async function getUidMap() {
  if (_uidMap) return _uidMap;
  _uidMap = {};
  try {
    let file = Gio.File.new_for_path("/etc/passwd");
    return new Promise((resolve) => {
      file.load_contents_async(null, (file, res) => {
        try {
          let [ok, content] = file.load_contents_finish(res);
          if (ok) {
            let text = new TextDecoder().decode(content);
            text.split("\n").forEach((line) => {
              let parts = line.split(":");
              if (parts.length >= 3) _uidMap[parts[2]] = parts[0];
            });
          }
        } catch (e) {}
        resolve(_uidMap);
      });
    });
  } catch (e) {
    return _uidMap;
  }
}

export async function getActiveDevPorts(cancellable = null) {
  const uidMap = await getUidMap();
  return new Promise((resolve) => {
    try {
      let proc = new Gio.Subprocess({
        argv: ["ss", "-ltnpeH"],
        flags:
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });
      proc.init(cancellable);

      let signalId = 0;
      if (cancellable) {
        signalId = cancellable.connect(() => {
          try {
            proc.force_exit();
          } catch (e) {}
        });
      }

      proc.communicate_utf8_async(null, cancellable, (proc, res) => {
        if (cancellable && signalId > 0) {
          cancellable.disconnect(signalId);
        }
        try {
          let [, stdout] = proc.communicate_utf8_finish(res);
          resolve(parseSsOutput(stdout || "", uidMap));
        } catch (e) {
          resolve([]);
        }
      });
    } catch (e) {
      resolve([]);
    }
  });
}

function parseSsOutput(output, uidMap) {
  if (!output) return [];
  let lines = output.trim().split("\n");
  let activePorts = [];
  let seenPorts = new Set();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let parts = line.split(/\s+/);
    let localAddress = parts[3];
    if (!localAddress) continue;

    let portMatch = localAddress.match(/:(\d+)$/);
    if (!portMatch) continue;

    let port = parseInt(portMatch[1], 10);
    if (EXCLUDED_PORTS.includes(port) || seenPorts.has(port)) continue;

    let processName = "Unknown";
    let pid = "-";

    let usersMatch = line.match(/users:\(\("([^"]+)",(?:pid|pgid)=(\d+)/);
    if (usersMatch) {
      processName = usersMatch[1];
      pid = usersMatch[2];
    } else {
      let cgroupMatch =
        line.match(/cgroup:[^ ]+\/([^/ \n]+)$/) ||
        line.match(/cgroup:[^ ]+\/([^/ ]+)\.service/);
      if (cgroupMatch) {
        processName = cgroupMatch[1]
          .replace(/\.service$/, "")
          .replace(/^system-/, "");
        processName =
          processName.charAt(0).toUpperCase() + processName.slice(1);
      } else {
        let uidMatch = line.match(/uid:(\d+)/);
        if (uidMatch) {
          let user = uidMap[uidMatch[1]] || uidMatch[1];
          processName = `User: ${user}`;
        }
      }
    }

    if (line.includes("docker.service") && processName === "Unknown") {
      processName = "Docker";
    }

    let isLocal =
      localAddress.startsWith("127.") ||
      localAddress.startsWith("[::1]") ||
      localAddress.startsWith("localhost");

    seenPorts.add(port);
    activePorts.push({
      port: port,
      process: processName,
      pid: pid,
      localOnly: isLocal,
    });
  }

  return activePorts.sort((a, b) => a.port - b.port);
}
