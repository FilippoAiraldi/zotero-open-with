/* global Zotero, Services, Components */
"use strict";

Zotero.OpenWith = {
	PREF_APP_PATH: "extensions.zotero-open-with.appPath",
	PREF_APP_NAME: "extensions.zotero-open-with.appName",
	MENU_ID: "zotero-open-with-item",
	CONFIRM_THRESHOLD: 5,

	KNOWN_PATHS: [
		"C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe",
		"C:\\Program Files (x86)\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe",
		"C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
		"C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
		"C:\\Program Files\\Adobe\\Acrobat Reader\\Reader\\AcroRd32.exe",
	],

	id: null,
	rootURI: null,
	_registeredMenuID: null,
	_detectedPath: undefined,

	init({ id, rootURI }) {
		this.id = id;
		this.rootURI = rootURI;
	},

	log(msg) {
		Zotero.debug(`[Open With] ${msg}`);
	},

	// ---------------------------------------------------------------------
	// App resolution
	// ---------------------------------------------------------------------

	_fileExists(path) {
		try {
			return !!path && Zotero.File.pathToFile(path).exists();
		}
		catch (e) {
			return false;
		}
	},

	_readAppPathsRegistry(exeName) {
		if (!Zotero.isWin) return null;
		for (let root of ["ROOT_KEY_LOCAL_MACHINE", "ROOT_KEY_CURRENT_USER"]) {
			let key;
			try {
				key = Components.classes["@mozilla.org/windows-registry-key;1"]
					.createInstance(Components.interfaces.nsIWindowsRegKey);
				key.open(
					key[root],
					`SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
					key.ACCESS_READ
				);
				let value = key.readStringValue("").replace(/^"|"$/g, "");
				if (value) return value;
			}
			catch (e) {
				// Key not present
			}
			finally {
				try {
					key?.close();
				}
				catch (e) {}
			}
		}
		return null;
	},

	/**
	 * Find an Adobe Acrobat (or Reader) executable. Result is cached.
	 * @returns {string|null}
	 */
	detectAcrobat() {
		if (this._detectedPath !== undefined && this._fileExists(this._detectedPath)) {
			return this._detectedPath;
		}
		let candidates = [
			this._readAppPathsRegistry("Acrobat.exe"),
			this._readAppPathsRegistry("AcroRd32.exe"),
			...this.KNOWN_PATHS,
		];
		this._detectedPath = candidates.find(p => this._fileExists(p)) || null;
		this.log(`Detected app: ${this._detectedPath}`);
		return this._detectedPath;
	},

	/**
	 * The configured app path, or the auto-detected one if none is set.
	 * @returns {string|null}
	 */
	getAppPath() {
		let configured = (Zotero.Prefs.get(this.PREF_APP_PATH, true) || "").trim();
		if (configured) return configured.replace(/^"|"$/g, "");
		return this.detectAcrobat();
	},

	getAppName() {
		let name = (Zotero.Prefs.get(this.PREF_APP_NAME, true) || "").trim();
		if (name) return name;
		let path = this.getAppPath();
		if (!path) return "Acrobat";
		let base = path.split(/[\\/]/).pop().replace(/\.exe$/i, "");
		if (/^acrobat$/i.test(base)) return "Adobe Acrobat";
		if (/^acrord32$/i.test(base)) return "Adobe Acrobat Reader";
		return base;
	},

	// ---------------------------------------------------------------------
	// Item resolution
	// ---------------------------------------------------------------------

	/**
	 * Cheap synchronous check used to decide whether the menu entry is shown
	 */
	hasPDF(item) {
		if (!item) return false;
		if (item.isPDFAttachment()) return true;
		if (!item.isRegularItem()) return false;
		return item.getAttachments().some((id) => {
			let att = Zotero.Items.get(id);
			return att && att.isPDFAttachment();
		});
	},

	/**
	 * @returns {Promise<Zotero.Item|null>} The PDF attachment to open for this item
	 */
	async resolvePDF(item) {
		if (!item) return null;
		if (item.isPDFAttachment()) return item;
		if (!item.isRegularItem()) return null;
		let best = await item.getBestAttachment();
		if (best && best.isPDFAttachment()) return best;
		// Best attachment is not a PDF (e.g. a snapshot) -- fall back to the first PDF
		for (let id of item.getAttachments()) {
			let att = Zotero.Items.get(id);
			if (att && att.isPDFAttachment()) return att;
		}
		return null;
	},

	// ---------------------------------------------------------------------
	// Opening
	// ---------------------------------------------------------------------

	async _l10n(id, args) {
		let win = Zotero.getMainWindow();
		try {
			let value = await win.document.l10n.formatValue(id, args);
			if (value) return value;
		}
		catch (e) {
			Zotero.logError(e);
		}
		return id;
	},

	async openItems(items) {
		let win = Zotero.getMainWindow();
		let title = await this._l10n("open-with-title");

		let appPath = this.getAppPath();
		if (!this._fileExists(appPath)) {
			let msg = appPath
				? await this._l10n("open-with-error-app-missing", { path: appPath })
				: await this._l10n("open-with-error-app-not-set");
			if (Services.prompt.confirm(win, title, msg)) {
				this.openSettings();
			}
			return;
		}

		// Resolve and de-duplicate attachments
		let attachments = new Map();
		for (let item of items || []) {
			let att = await this.resolvePDF(item);
			if (att) attachments.set(att.id, att);
		}
		if (!attachments.size) return;

		if (attachments.size > this.CONFIRM_THRESHOLD) {
			let msg = await this._l10n("open-with-confirm-many", {
				count: attachments.size,
				app: this.getAppName(),
			});
			if (!Services.prompt.confirm(win, title, msg)) return;
		}

		let missing = [];
		for (let att of attachments.values()) {
			let path = await att.getFilePathAsync();
			if (!path) {
				missing.push(att.getField("title") || att.attachmentFilename || att.key);
				continue;
			}
			try {
				this.log(`Opening ${path} with ${appPath}`);
				Zotero.launchFileWithApplication(path, appPath);
			}
			catch (e) {
				Zotero.logError(e);
				let msg = await this._l10n("open-with-error-launch", { message: e.message || String(e) });
				Services.prompt.alert(win, title, msg);
				return;
			}
		}

		if (missing.length) {
			let msg = await this._l10n("open-with-error-file-missing", {
				files: missing.join("\n"),
			});
			Services.prompt.alert(win, title, msg);
		}
	},

	openSettings() {
		Zotero.Utilities.Internal.openPreferences("zotero-open-with-prefs");
	},

	// ---------------------------------------------------------------------
	// Menu
	// ---------------------------------------------------------------------

	registerMenu() {
		this._registeredMenuID = Zotero.MenuManager.registerMenu({
			menuID: this.MENU_ID,
			pluginID: this.id,
			target: "main/library/item",
			menus: [
				{
					menuType: "menuitem",
					l10nID: "open-with-menuitem",
					l10nArgs: JSON.stringify({ app: this.getAppName() }),
					icon: this.rootURI + "icons/open-with.svg",
					onShowing: (event, context) => {
						let visible = !!context.items?.some(item => this.hasPDF(item));
						context.setVisible(visible);
						if (visible) {
							context.setL10nArgs(JSON.stringify({ app: this.getAppName() }));
						}
						try {
							this._moveToSecondPosition(context.menuElem);
						}
						catch (e) {
							Zotero.logError(e);
						}
					},
					onCommand: (event, context) => {
						this.openItems(context.items).catch(e => Zotero.logError(e));
					},
				},
			],
		});
		if (!this._registeredMenuID) {
			Zotero.logError(new Error("[Open With] Failed to register menu"));
		}
	},

	_isShown(elem) {
		return elem && !elem.hidden && elem.getAttribute("hidden") !== "true";
	},

	/**
	 * MenuManager always appends plugin items at the bottom, after a separator.
	 * Move our item right below the first visible entry (usually "View PDF"),
	 * and hide the plugin-group separator if nothing is left under it.
	 */
	_moveToSecondPosition(menuElem) {
		let popup = menuElem?.parentElement;
		if (!popup) return;

		let first = Array.from(popup.children).find(elem => elem !== menuElem
			&& (elem.localName === "menuitem" || elem.localName === "menu")
			&& this._isShown(elem));
		if (first && first.nextElementSibling !== menuElem) {
			first.after(menuElem);
		}

		// Other plugins' items may not exist yet, so check once the menu is fully built
		Promise.resolve().then(() => {
			let separator = popup.querySelector(":scope > menuseparator.zotero-custom-menu-group-separator");
			if (!separator) return;
			let hasItemsBelow = false;
			for (let el = separator.nextElementSibling; el; el = el.nextElementSibling) {
				if (el.localName !== "menuseparator" && this._isShown(el)) {
					hasItemsBelow = true;
					break;
				}
			}
			separator.hidden = !hasItemsBelow;
		});
	},

	unregisterMenu() {
		if (this._registeredMenuID) {
			Zotero.MenuManager.unregisterMenu(this._registeredMenuID);
			this._registeredMenuID = null;
		}
	},
};
