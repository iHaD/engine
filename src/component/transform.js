﻿FIRE.Transform = (function () {
    var _super = FIRE.Component;

    // constructor
    function Transform () {
        _super.call(this);
        init(this);
    }
    FIRE.extend(Transform, _super);
    Transform.prototype.__classname__ = "FIRE.Transform";

    // init
    var init = function (self) {
        self._parent = null;
        self._children = [];
        self._position = new FIRE.Vec2(0, 0);
    };

    // properties

    Transform.prototype.__defineGetter__('parent', function () { return this._parent; });
    Transform.prototype.__defineSetter__('parent', function (value) {
        // jshint eqeqeq: false
        if (this._parent != value) {
        // jshint eqeqeq: true
            if (value && value instanceof Transform === false) {
                console.error('Parent must be a Transform or null');
                return;
            }
            var oldParent = this._parent;
            if (oldParent) {
                oldParent._children.splice(oldParent._children.indexOf(this), 1);
            }
            this._parent = value;
            if (value) {
                value._children.push(this);
            }
            this.entity._onHierarchyChanged(oldParent);
        }
    });

    Transform.prototype.__defineGetter__('childCount', function () {
        return this._children.length;
    });

    Transform.prototype.__defineGetter__('position', function () { return this._position; });
    Transform.prototype.__defineSetter__('position', function (value) {
        this._position = value;
    });

    // built-in functions

    Transform.prototype.onDestroy = function () {
        this.parent = null; // TODO: may call onEnable on other component's
        // destroy child entitys
        var transform = this.transform;
        for (var i = 0, len = transform.childCount; i < len; ++i) {
            var entity = transform._children[i].entity;
            entity._destroyImmediate();
        }
    };

    Transform.prototype.destroy = function () {
        console.error("Not allowed to destroy the transform. Please destroy the entity instead.");
        return;
    };
    
    // other functions

    Transform.prototype.getChild = function (index) {
        return this._children[index];
    };

    return Transform;
})();