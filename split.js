define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "ace"
    ];
    main.provides = ["ace.split"];
    return main;
    
    /*
        Issues:
        - Folding isnt synced
        - No annotations
        - No breakpoints
        - Theme Switching
        - Setting Options
        - Resize when resizing split
        - Split is per tab, needs to switch accordingly
        - Proper resizing after initial create
        - Remove splitter / extra ace after split is removed
    */

    function main(options, imports, register) {
        var Plugin   = imports.Plugin;
        var ui       = imports.ui;
        var commands = imports.commands;
        var layout   = imports.layout;
        var ace      = imports.ace;
        var event    = require("ace/lib/event");
        
        var oop          = require("ace/lib/oop");
        var lang         = require("ace/lib/lang");
        var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
        
        var Editor       = require("ace/editor").Editor;
        var Renderer     = require("ace/virtual_renderer").VirtualRenderer;
        var EditSession  = require("ace/edit_session").EditSession;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit   = plugin.getEmitter();
        
        var editors = [];
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            ace.on("create", function(e){
                if (e.editor.type != "ace")
                    return;
                
                draw();
                
                var editor = e.editor;
                editor.once("draw", function(){
                    createGrabber(editor);
                }, plugin);
            });
            
            ace.on("themeChange", function(){
                editors.forEach(function(editor){
                    
                });
            }, plugin);
            
            ace.on("settingsUpdate", function(e){
                var options = e.options;
                editors.forEach(function(editor){
                    
                });
            }, plugin);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), plugin);
        
            emit("draw");
        }
        
        function createGrabber(editor){
            var htmlNode = editor.ace.container.parentNode;
            var grabber  = document.createElement("div");
            htmlNode.appendChild(grabber);
            grabber.className = "splitgrabber";
            grabber.innerHTML = "=";
            
            grabber.addEventListener("mousedown", function(e){
                startSplit(e, grabber, editor);
            });
            
            plugin.addOther(function(){
                grabber.parentNode.removeChild(grabber);
            });
        }
        
        /***** Methods *****/
        
        function startSplit(e, grabber, editor){
            var container = grabber;
            var drag      = grabber;
            
            grabber.className = "splitgrabber splitting";
            
            // Set Top
            drag.style.zIndex = 1000000;
            
            var offsetX = e.clientX - (parseInt(container.style.left, 10) || 0);
            var offsetY = e.clientY - (parseInt(container.style.top, 10) || 0);
            var moved   = false;
            var startX  = e.clientX - offsetX;
            var startY  = e.clientY - offsetY;
            
            event.capture(container, function(e) {
                var x = e.clientX - offsetX;
                var y = e.clientY - offsetY;
                
                if (!moved) {
                    if (Math.abs(x - startX) + Math.abs(y - startY) > 5) {
                        moved = true;
                        initSplit(grabber.parentNode, editor);
                    }
                    else return;
                }
                
                drag.style.top = y + "px";
                
                drag.style.display = "block";
            }, function() {
                if (moved) {
                    // layout.resizeTo(plugin, 
                    //     drag.offsetWidth, edge.indexOf("w") > -1, 
                    //     drag.offsetHeight, edge.indexOf("n") > -1);
                }
                
                drag.style.zIndex = "";
                drag.style.display = "none";
            });
            
            event.stopEvent(e);
        }
        
        function initSplit(container, editor){
            var amlNode = container.host;
            // @todo detect if this already happened
            
            var splitbox = amlNode.appendChild(new ui.vsplitbox({ 
                "class"  : "ace_split",
                padding  : 7,
                splitter : true 
            }));
            
            var topPane    = splitbox.appendChild(new ui.bar({ height: "50%" }));
            var bottomPane = splitbox.appendChild(new ui.bar());
            
            // Original Editor
            topPane.$int.appendChild(editor.ace.container);
            
            // New Editor
            var editor2 = new Editor(new Renderer(bottomPane.$int, ace.theme));
            // editor.on("focus", function() {
            //     this._emit("focus", editor);
            // }.bind(this));
            
            editor2.setSession(cloneSession(editor.ace.session));
            
            // var htmlNode = editor2.ace.container;
            // htmlNode.style.position = "absolute";
            // htmlNode.style.left = "0px";
            // htmlNode.style.right = "0px";
            // htmlNode.style.top = "0px";
            // htmlNode.style.bottom = "0px";
        }
        
        function cloneSession(session) {
            var s = new EditSession(session.getDocument(), session.getMode());
    
            var undoManager = session.getUndoManager();
            if (undoManager) {
                var undoManagerProxy = new UndoManagerProxy(undoManager, s);
                s.setUndoManager(undoManagerProxy);
            }
    
            // Overwrite the default $informUndoManager function such that new deltas
            // aren't added to the undo manager from the new and the old session.
            s.$informUndoManager = lang.delayedCall(function() { s.$deltas = []; });
    
            // Copy over 'settings' from the session.
            s.setTabSize(session.getTabSize());
            s.setUseSoftTabs(session.getUseSoftTabs());
            s.setOverwrite(session.getOverwrite());
            s.setBreakpoints(session.getBreakpoints());
            s.setUseWrapMode(session.getUseWrapMode());
            s.setUseWorker(session.getUseWorker());
            s.setWrapLimitRange(session.$wrapLimitRange.min,
                                session.$wrapLimitRange.max);
            s.$foldData = session.$cloneFoldData();
    
            return s;
        };
        
        function UndoManagerProxy(undoManager, session) {
            this.$u = undoManager;
            this.$doc = session;
        }
        
        (function() {
            this.execute = function(options) {
                this.$u.execute(options);
            };
        
            this.undo = function() {
                var selectionRange = this.$u.undo(true);
                if (selectionRange) {
                    this.$doc.selection.setSelectionRange(selectionRange);
                }
            };
        
            this.redo = function() {
                var selectionRange = this.$u.redo(true);
                if (selectionRange) {
                    this.$doc.selection.setSelectionRange(selectionRange);
                }
            };
        
            this.reset = function() {
                this.$u.reset();
            };
        
            this.hasUndo = function() {
                return this.$u.hasUndo();
            };
        
            this.hasRedo = function() {
                return this.$u.hasRedo();
            };
        }).call(UndoManagerProxy.prototype);
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn  = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            _events : [
                /**
                 * @event draw
                 */
                "draw"
            ]
        });
        
        register(null, {
            "ace.split": plugin
        });
    }
});