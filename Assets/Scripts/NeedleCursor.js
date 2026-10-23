//@component
// NeedleCursor.js

//@input Component.ScreenTransform screenTransform
//@input Component.ScriptComponent shapeController
//@input Component.ScriptComponent gameController
//@input Component.ScreenTransform fullScreenTransform {"hint":"A ScreenTransform whose anchors span the ENTIRE screen (-1,-1 to 1,1) — e.g. a full-screen background or root canvas object. Used to correctly convert raw touch coordinates into world space regardless of how deeply the needle is nested."}
//@input Component.ScreenTransform tipMarker {"hint":"REQUIRED for accurate calibration. Add an empty SceneObject with a Screen Transform, position it EXACTLY on the needle's visual tip in the editor (independent of any shape), and assign it here. This replaces calibrating against a shape's first vertex, which broke once shapes had different first-vertex positions."}

var needleTipOffset = null;
var needleStartCenter = null;

function calculateNeedleTipOffset() {
    var st = script.screenTransform;
    needleStartCenter = st.anchors.getCenter(); // local space, used only to reset position later

    var worldCenter = st.localPointToWorldPoint(new vec2(0, 0));

    // Calibrate against a fixed marker (independent of any shape) rather
    // than SHAPE_VERTICES[0] — different shapes have their first vertex
    // in different places, so using shape data here meant whichever shape
    // happened to load FIRST in a session silently became the calibration
    // reference, baking in an offset for every other shape that session.
    if (!script.tipMarker) {
        print("ERROR: NeedleCursor needs a tipMarker assigned for accurate calibration — see the Inspector hint.");
        return;
    }
    var tipWorldPos = script.tipMarker.localPointToWorldPoint(new vec2(0, 0));

    needleTipOffset = new vec2(
        worldCenter.x - tipWorldPos.x,
        worldCenter.y - tipWorldPos.y
    );
}

function getNeedleTipPosition() {
    if (!needleTipOffset) return null; // calibration hasn't run yet — nothing to report

    var st = script.screenTransform;
    var worldCenter = st.localPointToWorldPoint(new vec2(0, 0));
    return new vec2(
        worldCenter.x - needleTipOffset.x,
        worldCenter.y - needleTipOffset.y
    );
}

// Moves the needle so its TIP lands exactly on the given world-space
// point, reusing the offset calibrated in calculateNeedleTipOffset().
// Cancels any in-progress drag (nulls touchOffset) so the very next
// TouchMoveEvent doesn't immediately override this using a stale offset —
// the player has to re-grab the needle (a new TouchStartEvent) to keep
// dragging after a snap-back.
function placeNeedleAtWorldPoint(worldPoint) {
    var st = script.screenTransform;
    var parentST = st.getSceneObject().getParent().getComponent("Component.ScreenTransform");
    if (!parentST) {
        print("ERROR: Needle's parent object needs a Component.ScreenTransform to reposition the needle");
        return;
    }

    var desiredWorldCenter = new vec3(
        worldPoint.x + needleTipOffset.x,
        worldPoint.y + needleTipOffset.y,
        worldPoint.z
    );

    var localPos = parentST.worldPointToLocalPoint(desiredWorldCenter);
    st.anchors.setCenter(localPos);

    touchOffset = null;
}

// Moves the needle so its TIP lands exactly on SHAPE_VERTICES[index],
// reusing the offset calibrated in calculateNeedleTipOffset() (derived from
// wherever you manually placed the needle relative to vertex 0 in the
// editor). This works for any vertex, not just the one you positioned it
// at originally.
function placeNeedleAtVertex(index) {
    placeNeedleAtWorldPoint(script.shapeController.SHAPE_VERTICES[index]);
}

function placeNeedleAtRandomVertex() {
    var vertices = script.shapeController.SHAPE_VERTICES;
    var index = Math.floor(Math.random() * vertices.length);
    placeNeedleAtVertex(index);
    return index;
}

// Converts a raw touch position (0..1, y-down, full-screen-normalized) into
// a point in the needle's PARENT local space (-1..1), the same space
// anchors.setCenter expects. Goes touch -> NDC -> world (via a transform
// that actually spans the full screen) -> parent-local (via the needle's
// own parent transform). This mirrors the world<->local pattern already
// used in DotController/ShapeController, so it stays correct no matter
// how the needle is nested inside the UI (e.g. the round dial).
function touchToParentLocal(touchPos) {
    var ndcX = touchPos.x * 2 - 1;
    var ndcY = -(touchPos.y * 2 - 1);

    var worldPos = script.fullScreenTransform.localPointToWorldPoint(new vec2(ndcX, ndcY));

    var parentST = script.screenTransform.getSceneObject().getParent().getComponent("Component.ScreenTransform");
    if (!parentST) {
        print("ERROR: NeedleCursor's parent object needs a Component.ScreenTransform for touch conversion to work correctly");
        return new vec2(ndcX, ndcY); // fallback to old (approximate) behavior
    }
    return parentST.worldPointToLocalPoint(worldPos);
}

var touchOffset = null;

// TOUCH START — store offset
var touchStartEvent = script.createEvent("TouchStartEvent");
touchStartEvent.bind(function (eventData) {
    // Clear any stale off-target timer from a previous drag so lifting and
    // re-placing the finger doesn't inherit a near-expired fail countdown.
    if (script.gameController && script.gameController.resetFailTracking) {
        script.gameController.resetFailTracking();
    }

    var touchLocal = touchToParentLocal(eventData.getTouchPosition());

    // Current needle position
    var currentCenter = script.screenTransform.anchors.getCenter();

    // Store offset
    touchOffset = currentCenter.sub(touchLocal);
});

// TOUCH MOVE — apply offset
var touchMoveEvent = script.createEvent("TouchMoveEvent");
touchMoveEvent.bind(function (eventData) {
    if (!touchOffset) return;

    var touchLocal = touchToParentLocal(eventData.getTouchPosition());

    script.screenTransform.anchors.setCenter(
        touchLocal.add(touchOffset)
    );
});

// TOUCH END — reset offset
var touchEndEvent = script.createEvent("TouchEndEvent");
touchEndEvent.bind(function () {
    touchOffset = null;
});

var isCalibrated = false;

script.init = function () {
    // The tip offset is a fixed property of the needle art (distance from
    // its center pivot to its visual tip) — only valid to calculate while
    // the needle is still at its ORIGINAL editor-placed position. Recompute
    // it more than once and it'll calibrate against wherever the needle
    // happens to be sitting from the previous round instead.
    if (!isCalibrated) {
        calculateNeedleTipOffset();
        isCalibrated = true;
    }
    script.startVertexIndex = placeNeedleAtRandomVertex();
};

script.placeNeedleAtVertex = placeNeedleAtVertex;
script.placeNeedleAtRandomVertex = placeNeedleAtRandomVertex;
script.placeNeedleAtWorldPoint = placeNeedleAtWorldPoint;
script.getNeedleTipPosition = getNeedleTipPosition;

var touchMove = script.createEvent("TouchMoveEvent");
touchMove.bind(function () {
    var pos = getNeedleTipPosition();
    if (!pos) return; // round hasn't started yet (still loading turn state)
    script.gameController.onNeedleMove(pos)
});