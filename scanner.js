import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const TARGET_PORTS = [3000, 3306, 5000, 5432, 6379, 8000, 8080, 9090];

export async function getActiveDevPorts() {
    return new Promise((resolve, reject) => {
        try {
            let proc = new Gio.Subprocess({
                argv: ['ss', '-ltnp'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            proc.init(null);

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);

                    if (!proc.get_successful()) {
                        console.error(`PortsViewer Error: ${stderr}`);
                        resolve([]);
                        return;
                    }

                    resolve(parseSsOutput(stdout));
                } catch (e) {
                    console.error(`PortsViewer Communication Error: ${e}`);
                    resolve([]);
                }
            });
        } catch (e) {
            console.error(`PortsViewer Subprocess Error: ${e}`);
            resolve([]);
        }
    });
}

function parseSsOutput(output) {
    let lines = output.split('\n');
    let activePorts = [];
    let seenPorts = new Set(); 

    for (let i = 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        let parts = line.split(/\s+/);
        let localAddress = parts[3];
        let processInfo = parts.slice(5).join(' '); 

        if (!localAddress) continue;

        let portMatch = localAddress.match(/:(\d+)$/);
        if (!portMatch) continue;

        let port = parseInt(portMatch[1], 10);

        if (TARGET_PORTS.includes(port) && !seenPorts.has(port)) {
            let processName = "Unknown";
            let procMatch = processInfo.match(/"([^"]+)"/);
            if (procMatch) {
                processName = procMatch[1];
            }

            seenPorts.add(port);
            activePorts.push({
                port: port,
                process: processName
            });
        }
    }

    return activePorts.sort((a, b) => a.port - b.port);
}