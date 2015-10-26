define(['exports',"jquery-ui","app/lang","app/prefs","app/tabs","app/layout","app/drop",'app/restore','app/recent','app/editors','app/shortcuts','app/hash','app/definitions','app/find'], function (exports) {
    var version = '17.0.0';
    var locale = require("app/lang");
    var prefs = require("app/prefs");

    locale.load()
    .fail(function () {
        console.error("Cannot load language file");
    })
    .done(
        prefs.load()
        .then(function (lang) {
            // yay!
            var tabs = require("app/tabs");
            tabs.init();
            var editors = require("app/editors");
            editors.init();
            var tree = require("app/tree");
            tree.init();
            var site = require("app/site");
            site.init();

            site.load()
            .then(function() {
                require('app/restore').restoreBatch(prefs.getOpeningFilesBatch());
            });

            var layout = require("app/layout");
            layout.init();
            var recent = require("app/recent");
            recent.load();
            var shortcuts = require("app/shortcuts");
            var hash = require("app/hash");
            var definitions = require("app/definitions");
            var find = require("app/find");
        })
    );

    exports.getVersion = function() {
        return version;
    };
});