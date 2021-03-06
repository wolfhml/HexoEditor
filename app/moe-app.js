/*
 *  This file is part of Moeditor.
 *
 *  Copyright (c) 2016 Menci <huanghaorui301@gmail.com>
 *  Copyright (c) 2015 Thomas Brouard (for codes from Abricotine)
 *  Copyright (c) 2016 lucaschimweg
 *
 *  Moeditor is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Moeditor is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Moeditor. If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const MoeditorWindow = require('./moe-window'),
      MoeditorAction = require('./moe-action'),
      MoeditorFile = require('./moe-file'),
      shortcut = require('electron-localshortcut'),
      MoeditorLocale = require('./moe-l10n'),
      MoeditorShell = require('./moe-shell'),
      MoeditorAbout = require('./moe-about'),
      MoeditorSettings = require('./moe-settings'),
      fs = require('fs'),
      path = require('path');

class MoeditorApplication {
	constructor() {
		this.windows = new Array();
        this.newWindow = null;
	}

	open(fileName,defName) {
        if (typeof fileName === 'undefined') {
            this.windows.push(new MoeditorWindow(process.cwd(),defName));
        } else {
            this.windows.push(new MoeditorWindow(fileName,defName));
        }
	}

	run() {
        global.Const = require('./moe-const');

        app.setName(Const.name);

        const Configstore = require('configstore');
        this.config = new Configstore(Const.name, require('./moe-config-default'));
        this.Const = Const;

        this.locale = new MoeditorLocale();
        this.shellServer = new MoeditorShell();
        global.__ = str => this.locale.get(str);

        this.flag = new Object();

        const a = process.argv;
        if (a[0].endsWith('electron') && a[1] == '.') a.shift(), a.shift();
        else a.shift();
        var docs = a.filter((s) => {
            if (s == '--debug') moeApp.flag.debug = true;
            else if (s == '--about') moeApp.flag.about = true;
            else if (s == '--settings') moeApp.flag.settings = true;

            try {
                return s.substring(0, 2) !== '--' && (MoeditorFile.isTextFile(s) || MoeditorFile.isDirectory(s));
            } catch (e) {
                return false;
            }
        });

        if (moeApp.flag.about) {
            MoeditorAbout();
            return;
        }

        if (moeApp.flag.settings) {
            this.listenSettingChanges();
            MoeditorSettings();
            return;
        }

        if (typeof this.osxOpenFile === 'string') docs.push(this.osxOpenFile);

        if (docs.length == 0) this.open();
		else for (var i = 0; i < docs.length; i++) {
            docs[i] = path.resolve(docs[i]);
            this.addRecentDocument(docs[i]);
            this.open(docs[i]);
        }

        if (process.platform === 'darwin') this.registerAppMenu();
        else this.registerShortcuts();

        this.listenSettingChanges();
	}

    registerAppMenu() {
        require('./moe-menu')(
            {
                fileNew: (w) => {
                    MoeditorAction.openNew();
                },
                fileNewHexo: (w) => {
                    MoeditorAction.openNewHexo();
                },
                fileOpen: (w) => {
                    MoeditorAction.open();
                },
                fileSave: (w) => {
                    MoeditorAction.save(w);
                },
                fileSaveAs: (w) => {
                    MoeditorAction.saveAs(w);
                },
                fileExportHTML: (w) => {
                    w.webContents.send('action-export-html');
                },
                fileExportPDF: (w) => {
                    w.webContents.send('action-export-pdf');
                },
                modeToRead: (w) => {
                    w.webContents.send('change-edit-mode', 'read');
                },
                modeToWrite: (w) => {
                    w.webContents.send('change-edit-mode', 'write');
                },
                modeToPreview: (w) => {
                    w.webContents.send('change-edit-mode', 'preview');
                },
                about: (w) => {
                    MoeditorAbout();
                },
                settings: (w) => {
                    MoeditorSettings();
                }
            }
        );
    }

    registerShortcuts() {
        shortcut.register('CmdOrCtrl + N', () => {
            MoeditorAction.openNew();
        });

        shortcut.register('CmdOrCtrl + H', () => {
            MoeditorAction.openNewHexo();
        });

        shortcut.register('CmdOrCtrl + O', () => {
            MoeditorAction.open();
        });

        shortcut.register('CmdOrCtrl + S', () => {
            MoeditorAction.save();
        });

        shortcut.register('CmdOrCtrl + Shift + S', () => {
            MoeditorAction.saveAs();
        });

        // shortcut.register('CmdOrCtrl + R', () => {
        //     let w = require('electron').BrowserWindow.getFocusedWindow();
        //     if (w) w.webContents.send('change-edit-mode', 'read');
        // });

        shortcut.register('CmdOrCtrl + W', () => {
            let w = require('electron').BrowserWindow.getFocusedWindow();
            if (w) w.webContents.send('change-edit-mode', 'change');
        });

        shortcut.register('CmdOrCtrl + P', () => {
            let w = require('electron').BrowserWindow.getFocusedWindow();
            if (w) w.webContents.send('change-edit-mode', 'preview');
        });

        shortcut.register('CmdOrCtrl + Shift + P', () => {
            let w = require('electron').BrowserWindow.getFocusedWindow();
            if (w) w.webContents.send('change-edit-mode', 'changepreview');
        });

        shortcut.register('CmdOrCtrl + Alt + Shift + R', () => {
            let w = require('electron').BrowserWindow.getFocusedWindow();
            w.reload();
        });

        shortcut.register('CmdOrCtrl + Alt + Shift + F12', () => {
            let w = require('electron').BrowserWindow.getFocusedWindow();
            w.webContents.openDevTools();
        });


        /*
        shortcut.register('CmdOrCtrl + Shift + P', () => {
            let w = require('electron').BrowserWindow.getFocusedWindow();
            if (w) w.webContents.send('change-edit-mode', 'preview');
        });
        */
    }

    listenSettingChanges() {
        const ipcMain = require('electron').ipcMain;
        ipcMain.on('setting-changed', (e, arg) => {
            for (const window of require('electron').BrowserWindow.getAllWindows()) {
                window.webContents.send('setting-changed', arg);
            }
        });
    }

    addRecentDocument(path) {
        app.addRecentDocument(path);
    }

    getHighlightThemesDir(){
        const currTheme = this.config.get('render-theme')
        let themedir = 'github'
        if (!(currTheme == '*GitHub' || currTheme == '*No Theme')){
            if (currTheme.startsWith('*'))
                themedir = currTheme.slice(1).toLowerCase();
            else
                themedir = currTheme.toLowerCase();
        }
        themedir = path.join(moeApp.Const.path+'/views/highlightThemes/',themedir);
	    return (fs.existsSync(themedir)? themedir : '');
    }

    getHexo(){
        return this.hexo;
    }

    setHexo(hexo){
        this.hexo = hexo;
    }
}

MoeditorApplication.count = 0;

module.exports = MoeditorApplication;
