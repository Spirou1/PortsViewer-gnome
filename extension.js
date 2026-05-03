/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib'; 

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { getActiveDevPorts } from './scanner.js';

const PortsIndicator = GObject.registerClass(
class PortsIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Ports Viewer Indicator');

        let topBox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        
        let icon = new St.Icon({
            icon_name: 'network-workgroup-symbolic',
            style_class: 'system-status-icon',
        });
        
        this._topLabel = new St.Label({
            text: 'Active Ports: 0',
            y_align: Clutter.ActorAlign.CENTER,
            margin_left: 6
        });
        
        topBox.add_child(icon);
        topBox.add_child(this._topLabel);
        this.add_child(topBox);

        this.visible = false;

        this._titleItem = new PopupMenu.PopupSeparatorMenuItem('Portas Abertas');
        this.menu.addMenuItem(this._titleItem);

        this._portsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._portsSection);

        this._isScanning = false;
        
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._syncPorts();
            return GLib.SOURCE_CONTINUE;
        });
        
        this._syncPorts();
    }

    async _syncPorts() {
        if (this._isScanning) return;
        this._isScanning = true;

        let ports = await getActiveDevPorts();

        if (ports.length > 0) {
            this._topLabel.text = `Active Ports: ${ports.length}`;
            this.visible = true;
        } else {
            this.visible = false;
        }

        this._portsSection.removeAll();
        for (let p of ports) {
            let item = new PopupMenu.PopupBaseMenuItem();
            
            let portLabel = new St.Label({
                text: `${p.port}`,
                style_class: 'port-number-highlight',
                y_align: Clutter.ActorAlign.CENTER
            });
            
            let processLabel = new St.Label({
                text: `  —  ${p.process}`,
                y_align: Clutter.ActorAlign.CENTER
            });
            
            item.add_child(portLabel);
            item.add_child(processLabel);

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
});

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
    }
}
