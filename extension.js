import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

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
        text: "Ports: 0",
        y_align: Clutter.ActorAlign.CENTER,
        margin_left: 6,
      });

      topBox.add_child(icon);
      topBox.add_child(this._topLabel);
      this.add_child(topBox);

      this.visible = false;

      this._portsSection = new PopupMenu.PopupMenuSection();
      let title = new PopupMenu.PopupSeparatorMenuItem("Open Ports");
      title.label.add_style_class_name("port-menu-title");
      title._separator.add_style_class_name("port-menu-line");
      this.menu.addMenuItem(title);
      this.menu.addMenuItem(this._portsSection);

      this._isScanning = false;
      this._cancellable = null;
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

      const cancellable = (this._cancellable = new Gio.Cancellable());

      let ports = [];
      try {
        ports = await getActiveDevPorts(cancellable);
      } catch (e) {

      }

      this._isScanning = false;

      if (cancellable.is_cancelled() || this._cancellable !== cancellable)
        return;

      this._cancellable = null;

      this._topLabel.text = `Ports: ${ports.length}`;
      this.visible = ports.length > 0;

      this._portsSection.removeAll();
      this._feedbackItem = null;

      let header = new PopupMenu.PopupBaseMenuItem({
        activate: false,
        reactive: false,
      });

      let hPort = new St.Label({
        text: "PORT",
        style_class: "port-header-label port-number-column",
      });
      let hPid = new St.Label({
        text: "PID",
        style_class: "port-header-label",
      });
      let hPidBox = new St.BoxLayout({
        style_class: "port-pid-column port-column-gap",
      });
      hPidBox.add_child(hPid);
      let hProc = new St.Label({
        text: "SERVICE",
        style_class: "port-header-label port-column-gap",
        x_expand: true,
      });
      let hAcc = new St.Label({
        text: "USER",
        style_class: "port-header-label port-column-gap",
      });

      header.add_child(hPort);
      header.add_child(hPidBox);
      header.add_child(hProc);
      header.add_child(hAcc);
      this._portsSection.addMenuItem(header);

      for (let p of ports) {
        let item = new PopupMenu.PopupBaseMenuItem({ activate: false });

        let portLabel = new St.Label({
          text: `${p.port}`,
          style_class: "port-number-value port-number-column",
        });

        let pidLabel = new St.Label({
          text: `${p.pid}`,
          style_class: "port-pid-value",
        });

        let processLabel = new St.Label({
          text: `${p.process}`,
          style_class: "port-service-value port-column-gap",
          x_expand: true,
        });

        let statusLabel = new St.Label({
          text: p.user,
          style_class:
            (p.localOnly ? "port-user-local" : "port-user-public") +
            " port-column-gap",
        });

        let copyIcon = new St.Icon({
          icon_name: "edit-copy-symbolic",
          icon_size: 12,
          style_class: "port-copy-icon",
          reactive: true,
          track_hover: true,
        });
        copyIcon.connect("button-release-event", () => {
          this._copyPid(p.pid);
          return Clutter.EVENT_STOP;
        });

        let pidBox = new St.BoxLayout({
          style_class: "port-pid-column port-column-gap",
        });
        pidBox.add_child(pidLabel);
        pidBox.add_child(copyIcon);

        item.add_child(portLabel);
        item.add_child(pidBox);
        item.add_child(processLabel);
        item.add_child(statusLabel);

        this._portsSection.addMenuItem(item);
      }
    }

    _copyPid(pid) {
      St.Clipboard.get_default().set_text(
        St.ClipboardType.CLIPBOARD,
        pid.toString(),
      );

      if (this._feedbackItem) {
        this._feedbackItem.destroy();
        this._feedbackItem = null;
      }

      this._feedbackItem = new PopupMenu.PopupBaseMenuItem({
        activate: false,
        reactive: false,
      });
      let label = new St.Label({
        text: `✓ PID ${pid} copied`,
        style_class: "port-copy-feedback",
      });
      this._feedbackItem.add_child(label);
      this._portsSection.addMenuItem(this._feedbackItem);
    }

    destroy() {
      if (this._timeoutId) {
        GLib.Source.remove(this._timeoutId);
        this._timeoutId = null;
      }
      if (this._cancellable) {
        this._cancellable.cancel();
        this._cancellable = null;
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
