/* global Zotero, Services */
"use strict";

const FTL_FILE = "open-with.ftl";

function install() {}

async function startup({ id, version, rootURI }) {
	await Zotero.initializationPromise;

	Services.scriptloader.loadSubScript(rootURI + "openWith.js");
	Zotero.OpenWith.init({ id, version, rootURI });

	await Zotero.PreferencePanes.register({
		pluginID: id,
		id: "zotero-open-with-prefs",
		src: rootURI + "preferences.xhtml",
		scripts: [rootURI + "preferences.js"],
		image: rootURI + "icons/icon.svg",
		label: "Open With",
	});

	Zotero.OpenWith.registerMenu();

	for (let window of Zotero.getMainWindows()) {
		onMainWindowLoad({ window });
	}
}

function onMainWindowLoad({ window }) {
	window.MozXULElement.insertFTLIfNeeded(FTL_FILE);
}

function onMainWindowUnload({ window }) {
	window.document.querySelector(`[href="${FTL_FILE}"]`)?.remove();
}

function shutdown() {
	if (!Zotero.OpenWith) return;
	Zotero.OpenWith.unregisterMenu();
	for (let window of Zotero.getMainWindows()) {
		onMainWindowUnload({ window });
	}
	delete Zotero.OpenWith;
}

function uninstall() {}
