/* global Zotero, ChromeUtils, window, document */
"use strict";

// Loaded into a sandbox (prototype: the Settings window) *before* the pane's
// markup is inserted. Zotero then dispatches a non-bubbling `load` event to the
// pane's top-level elements, which a capturing listener on the document sees.
var ZoteroOpenWithPrefs = {
	PREF_APP_PATH: "extensions.zotero-open-with.appPath",
	ROOT_ID: "zotero-open-with-prefs-root",

	init(root) {
		if (!root || root.dataset.openWithInit) return;
		root.dataset.openWithInit = "true";
		let doc = root.ownerDocument;
		doc.getElementById("zotero-open-with-browse")
			.addEventListener("command", () => this.browse(doc));
		doc.getElementById("zotero-open-with-app-path")
			.addEventListener("input", () => this.updateDetected(doc));
		this._prefObserver = Zotero.Prefs.registerObserver(
			this.PREF_APP_PATH,
			() => this.updateDetected(doc),
			true
		);
		root.ownerGlobal.addEventListener("unload", () => {
			if (this._prefObserver) Zotero.Prefs.unregisterObserver(this._prefObserver);
		}, { once: true });
		this.updateDetected(doc);
	},

	updateDetected(doc) {
		let elem = doc.getElementById("zotero-open-with-detected");
		if (!elem || !Zotero.OpenWith) return;
		let configured = (doc.getElementById("zotero-open-with-app-path").value || "").trim();
		if (configured) {
			let exists = Zotero.OpenWith._fileExists(configured.replace(/^"|"$/g, ""));
			doc.l10n.setAttributes(elem, exists
				? "open-with-prefs-path-ok"
				: "open-with-prefs-path-missing");
			return;
		}
		let detected = Zotero.OpenWith.detectAcrobat();
		if (detected) {
			doc.l10n.setAttributes(elem, "open-with-prefs-detected", { path: detected });
		}
		else {
			doc.l10n.setAttributes(elem, "open-with-prefs-not-detected");
		}
	},

	async browse(doc) {
		try {
			await this._browse(doc);
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	async _browse(doc) {
		let { FilePicker } = ChromeUtils.importESModule(
			"chrome://zotero/content/modules/filePicker.mjs"
		);
		let fp = new FilePicker();
		let title = await doc.l10n.formatValue("open-with-prefs-browse-title");
		fp.init(doc.defaultView, title, fp.modeOpen);
		if (Zotero.isWin) {
			fp.appendFilter("Applications", "*.exe");
		}
		fp.appendFilters(fp.filterAll);

		let current = Zotero.OpenWith?.getAppPath();
		if (current) {
			try {
				let dir = Zotero.File.pathToFile(current).parent;
				if (dir?.exists()) fp.displayDirectory = dir.path;
			}
			catch (e) {}
		}

		let rv = await fp.show();
		if (rv !== fp.returnOK) return;
		// The bound input updates itself via the preference observer
		Zotero.Prefs.set(this.PREF_APP_PATH, fp.file, true);
	},
};

{
	let onLoad = (event) => {
		if (event.target?.id === ZoteroOpenWithPrefs.ROOT_ID) {
			document.removeEventListener("load", onLoad, true);
			ZoteroOpenWithPrefs.init(event.target);
		}
	};
	document.addEventListener("load", onLoad, true);

	// In case the markup is already in place
	let existing = document.getElementById(ZoteroOpenWithPrefs.ROOT_ID);
	if (existing) {
		document.removeEventListener("load", onLoad, true);
		ZoteroOpenWithPrefs.init(existing);
	}
}
