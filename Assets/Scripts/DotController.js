//@component
// @input SceneObject dotContainer
// @input Asset.ObjectPrefab dotPrefab
//@input Component.ScriptComponent shapeController
//@input float dotSizeMultiplier = 2.0 {"hint":"Dot diameter as a multiple of edgeTolerance (the shape's stroke half-width), so dots visually match the line thickness at any screen size or shape."}

var dotObjects = [];
var dotLocalSize = null; // cached per-shape; same for every dot since edgeTolerance is shape-wide

function checkContainerAlignment() {
    var containerST = script.dotContainer.getComponent("Component.ScreenTransform");
    var shapeST = script.shapeController.shapeObject && script.shapeController.shapeObject.getComponent("Component.ScreenTransform");
    if (!containerST || !shapeST) return;

    var cBL = containerST.localPointToWorldPoint(new vec2(-1, -1));
    var cTR = containerST.localPointToWorldPoint(new vec2(1, 1));
    var sBL = shapeST.localPointToWorldPoint(new vec2(-1, -1));
    var sTR = shapeST.localPointToWorldPoint(new vec2(1, 1));

    var shapeWidth = Math.abs(sTR.x - sBL.x);
    var shapeHeight = Math.abs(sTR.y - sBL.y);
    var shapeSize = Math.max(shapeWidth, shapeHeight) || 1;

    var cornerDrift = Math.max(
        Math.abs(cBL.x - sBL.x), Math.abs(cBL.y - sBL.y),
        Math.abs(cTR.x - sTR.x), Math.abs(cTR.y - sTR.y)
    );
    var driftPct = (cornerDrift / shapeSize) * 100;

    if (driftPct > 0.5) {
        print("WARNING: dotContainer's on-screen rect doesn't match shapeObject's rect (off by ~" + driftPct.toFixed(1) + "% of shape size).");
    } else {
        print("dotContainer/shapeObject alignment check OK (drift ~" + driftPct.toFixed(2) + "%)");
    }
}

// Converts a world-space diameter into a local size in dotContainer's own
// space, using the container's own on-screen extents as the conversion
// scale (mirrors the world<->local pattern used elsewhere in this file).
// This keeps dot size correct regardless of screen size or how deeply
// dotContainer is nested.
function computeDotLocalSize(containerST, worldDiameter) {
    var bl = containerST.localPointToWorldPoint(new vec2(-1, -1));
    var tr = containerST.localPointToWorldPoint(new vec2(1, 1));
    var worldWidth = Math.abs(tr.x - bl.x) || 1;
    var worldHeight = Math.abs(tr.y - bl.y) || 1;

    return new vec2(
        worldDiameter * (2 / worldWidth),
        worldDiameter * (2 / worldHeight)
    );
}

function initDotPool() {
    // Clear out any dots from a previous shape (e.g. if you rebuild at runtime)
    for (var i = 0; i < dotObjects.length; i++) {
        dotObjects[i].destroy();
    }
    dotObjects = [];

    checkContainerAlignment();

    // Pre-compute this shape's dot size once — edgeTolerance (and thus the
    // stroke width dots should match) is the same for every dot on a given
    // shape, so there's no need to redo this per-dot in placeDot().
    var containerST = script.dotContainer.getComponent("Component.ScreenTransform");
    if (containerST) {
        var worldDiameter = script.shapeController.edgeTolerance * 2 * script.dotSizeMultiplier;
        dotLocalSize = computeDotLocalSize(containerST, worldDiameter);
    } else {
        dotLocalSize = null;
    }

    // Spawn exactly as many dots as this shape's perimeter needs
    var count = script.shapeController.perimeterPoints.length;
    for (var i = 0; i < count; i++) {
        var dot = script.dotPrefab.instantiate(script.dotContainer);
        dot.enabled = false;
        dotObjects.push(dot);
    }
    print("Dot pool ready: " + dotObjects.length + " dots");
}

function placeDot(index) {
    if (index >= dotObjects.length) return;
    var dot = dotObjects[index];
    var worldPos = script.shapeController.perimeterPoints[index];

    // anchors.setCenter expects a point local to the dot's PARENT, not world
    // space, so convert through dotContainer's own transform.
    var containerST = script.dotContainer.getComponent("Component.ScreenTransform");
    if (!containerST) {
        print("ERROR: dotContainer needs a Component.ScreenTransform attached to it (Add Component > Screen Transform in the Inspector)");
        return;
    }
    var localPos = containerST.worldPointToLocalPoint(worldPos);

    var st = dot.getComponent("Component.ScreenTransform");
    st.anchors.setCenter(localPos);
    if (dotLocalSize) {
        st.anchors.setSize(dotLocalSize);
    }
    dot.enabled = true;
}

script.init = function () {
    initDotPool();
};

script.placeDot = placeDot;