﻿var Camera = (function () {

    var Camera = Fire.extend('Fire.Camera', Component, function () {
        this._renderContext = null;
        this._contentStrategyInst = null;
    });
    Fire.addComponentMenu(Camera, 'Camera');
    Fire.executeInEditMode(Camera);

    Camera.prop('_background', new Fire.Color(0, 0, 0), Fire.HideInInspector);
    Camera.getset('background',
        function () {
            return this._background;
        },
        function (value) {
            this._background = value;
            if (this._renderContext) {
                this._renderContext.background = value;
            }
        }
    );

    Camera.prop('_size', 800, Fire.HideInInspector);
    Camera.getset('size',
        function () {
            return this._size;
        },
        function (value) {
            this._size = value;

        },
        Fire.Tooltip("The height of design resolution. Width varies depending on viewport's aspect ratio"),
        Fire.Watch('_contentStrategy', function (obj, propEL) {
            propEL.disabled = (obj._contentStrategy === Fire.ContentStrategyType.NoScale);
        })
    );

    Camera.prop('_contentStrategy', Fire.ContentStrategyType.FixedHeight, Fire.HideInInspector);
    Camera.getset('contentStrategy',
        function () {
            return this._contentStrategy;
        },
        function (value) {
            this._contentStrategy = value;
            this._contentStrategyInst = Fire.Screen.ContentStrategy.fromType(value);
        },
        Fire.DisplayName('Scale Strategy'),
        Fire.Enum(Fire.ContentStrategyType),
        Fire.Tooltip("The type of scale strategy for this camera")
    );

    Object.defineProperty(Camera.prototype, 'viewportInfo', {
        get: function (value) {
            var viewportSize = (this._renderContext || Engine._renderContext).size;
            return this._contentStrategyInst.apply(new Vec2(0, this._size), viewportSize);
        }
    });

    //Object.defineProperty(Camera.prototype, 'scaleStrategyInst', {
    //    get: function (value) {
    //        if ( !this._cachedResolutionPolicy ) {
    //            this._cachedResolutionPolicy = Fire.Screen.ResolutionPolicy.fromType(this._resolutionPolicy);
    //        }
    //        return this._cachedResolutionPolicy;
    //    }
    //});

    // save the render context this camera belongs to, if null, main render context will be used.
    Object.defineProperty(Camera.prototype, 'renderContext', {
        set: function (value) {
            this._renderContext = value;
//// @ifdef EDITOR
//            if ( !Engine.isPlaying ) {
//                this.size = value.size.y;
//            }
//// @endif
            this._applyRenderSettings();
        }
    });

    // built-in functions
    Camera.prototype.onLoad = function () {
        if (!(this.entity._objFlags & HideInGame)) {
            this.renderContext = Engine._renderContext;
        }
        this._contentStrategyInst = Fire.Screen.ContentStrategy.fromType(this._contentStrategy);
    };
    Camera.prototype.onEnable = function () {
        if (!(this.entity._objFlags & HideInGame)) {
            Engine._scene.camera = this;
            this._applyRenderSettings();
        }
    };
    Camera.prototype.onDisable = function () {
        if (Engine._scene.camera === this) {
            Engine._scene.camera = null;
        }
        this._renderContext.camera = null;
    };

    // other functions

    /**
     * Transforms position from viewport space into screen space.
     * @method Fire.Camera#viewportToScreen
     * @param {Fire.Vec2} position
     * @param {Fire.Vec2} [out] - optional, the receiving vector
     * @return {Fire.Vec2}
     */
    Camera.prototype.viewportToScreen = function (position, out) {
        out = this._renderContext.size.scale(position, out);
        return out;
    };

    /**
     * Transforms position from screen space into viewport space.
     * @method Fire.Camera#screenToViewport
     * @param {Fire.Vec2} position
     * @param {Fire.Vec2} [out] - optional, the receiving vector
     * @return {Fire.Vec2}
     */
    Camera.prototype.screenToViewport = function (position, out) {
        out = out || new Vec2();
        var size = this._renderContext.size;
        out.x = position.x / size.x;
        out.y = position.y / size.y;
        return out;
    };

    /**
     * Transforms position from viewport space into world space.
     * @method Fire.Camera#viewportToWorld
     * @param {Fire.Vec2} position
     * @param {Fire.Vec2} [out] - optional, the receiving vector
     * @return {Fire.Vec2}
     */
    Camera.prototype.viewportToWorld = function (position, out) {
        out = this.viewportToScreen(position, out);
        return this.screenToWorld(out, out);
    };

    /**
     * Transforms position from screen space into world space.
     * @method Fire.Camera#screenToWorld
     * @param {Fire.Vec2} position
     * @param {Fire.Vec2} [out] - optional, the receiving vector
     * @return {Fire.Vec2}
     */
    Camera.prototype.screenToWorld = function (position, out) {
        var halfScreenSize = (this._renderContext || Engine._renderContext).size.mulSelf(0.5);
        var pivotToScreen = position.sub(halfScreenSize, halfScreenSize);
        pivotToScreen.y = -pivotToScreen.y; // 屏幕坐标的Y和世界坐标的Y朝向是相反的
        var mat = new Matrix23();
        var camPos = new Vec2();
        this._calculateTransform(mat, camPos);
        mat.invert();
        mat.tx = camPos.x;
        mat.ty = camPos.y;
        return mat.transformPoint(pivotToScreen, out);
    };

    /**
     * Transforms position from world space into screen space.
     * @method Fire.Camera#worldToScreen
     * @param {Fire.Vec2} position
     * @param {Fire.Vec2} [out] - optional, the receiving vector
     * @return {Fire.Vec2}
     */
    Camera.prototype.worldToScreen = function (position, out) {
        var mat = new Matrix23();
        var camPos = new Vec2();
        this._calculateTransform(mat, camPos);
        var toCamera = position.sub(camPos, camPos);
        out = mat.transformPoint(toCamera, out);
        var height = (this._renderContext || Engine._renderContext).size.y;
        out.y = height - out.y;
        return out;
    };

    /**
     * Transforms position from world space into viewport space.
     * @method Fire.Camera#worldToViewport
     * @param {Fire.Vec2} position
     * @param {Fire.Vec2} [out] - optional, the receiving vector
     * @return {Fire.Vec2}
     */
    Camera.prototype.worldToViewport = function (position, out) {
        out = this.worldToScreen(position, out);
        return this.screenToViewport(out, out);
    };

    Camera.prototype._calculateTransform = function (out_matrix, out_worldPos) {
        var viewportInfo = this.viewportInfo;
        var scale = viewportInfo.scale;
        var viewport = viewportInfo.viewport;

        var tf = this.entity.transform;
        var mat = tf.getLocalToWorldMatrix();

        out_worldPos.x = mat.tx;
        out_worldPos.y = mat.ty;

        out_matrix.identity();
        out_matrix.tx = viewport.width * 0.5;
        out_matrix.ty = viewport.height * 0.5;
        out_matrix.a = scale.x;
        out_matrix.d = scale.y;
        out_matrix.rotate(mat.getRotation());
    };

    Camera.prototype._applyRenderSettings = function () {
        // @ifdef EDITOR
        if (!this._renderContext) {
            Fire.error('No corresponding render context for camera ' + this.entity.name);
            return;
        }
        // @endif
        this._renderContext.background = this._background;
    };

    return Camera;
})();

Fire.Camera = Camera;
