/* extension.js */
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { getActiveDevPorts, exportClearCache } from "./scanner.js";

const PortsIndicator = GObject.registerClass(
  class PortsIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, "Ports Viewer Indicator");

      let topBox = new St.BoxLayout({ style_class: "panel-status-menu-box" });
      let icon = new St.Icon({
        icon_name: "network-workgroup-symbolic",
        style_class: "system-status-icon",
      });

      this._topLabel = new St.Label({
        text: "Active Ports: 0",
        y_align: Clutter.ActorAlign.CENTER,
        margin_left: 6,
      });

      topBox.add_child(icon);
      topBox.add_child(this._topLabel);
      this.add_child(topBox);

      this.visible = false;

      this._portsSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem("Open Ports"));
      this.menu.addMenuItem(this._portsSection);

      this._isScanning = false;
      this._timeoutId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        5,
        () => {
          this._syncPorts();
          return GLib.SOURCE_CONTINUE;
        },
      );

      this._syncPorts();
    }

    async _syncPorts() {
      if (this._isScanning) return;
      this._isScanning = true;

      let ports = await getActiveDevPorts();
      this._topLabel.text = `Active Ports: ${ports.length}`;
      this.visible = ports.length > 0;

      this._portsSection.removeAll();

      let header = new PopupMenu.PopupBaseMenuItem({
        activate: false,
        reactive: false,
      });

      let hPort = new St.Label({
        text: "PORT",
        style_class: "port-header-label",
      });
      hPort.set_width(55);
      let hPid = new St.Label({
        text: "PID",
        style_class: "port-header-label",
      });
      hPid.set_width(65);
      let hProc = new St.Label({
        text: "SERVICE",
        style_class: "port-header-label",
        x_expand: true,
      });
      let hAcc = new St.Label({
        text: "ACCESS",
        style_class: "port-header-label port-access-column",
      });

      header.add_child(hPort);
      header.add_child(hPid);
      header.add_child(hProc);
      header.add_child(hAcc);
      this._portsSection.addMenuItem(header);

      for (let p of ports) {
        let item = new PopupMenu.PopupBaseMenuItem({ activate: false });

        let portLabel = new St.Label({
          text: `${p.port}`,
          style_class: "port-number-highlight",
        });
        portLabel.set_width(55);

        let pidLabel = new St.Label({
          text: `${p.pid}`,
          style_class: "port-pid-value",
        });
        pidLabel.set_width(65);

        let processLabel = new St.Label({
          text: `${p.process}`,
          style_class: "port-process-label",
          x_expand: true,
        });

        let statusLabel = new St.Label({
          text: p.localOnly ? "Local" : "Public",
          style_class:
            (p.localOnly ? "port-label-local" : "port-label-public") +
            " port-access-column",
        });

        item.add_child(portLabel);
        item.add_child(pidLabel);
        item.add_child(processLabel);
        item.add_child(statusLabel);

        this._portsSection.addMenuItem(item);
      }

      this._isScanning = false;
    }

    destroy() {
      if (this._timeoutId) {
        GLib.Source.remove(this._timeoutId);
        this._timeoutId = null;
      }
      super.destroy();
    }
  },
);

export default class PortsViewerExtension extends Extension {
  enable() {
    this._indicator = new PortsIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
    exportClearCache();
  }
}
