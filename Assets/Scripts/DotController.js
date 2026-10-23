//@component
// @input SceneObject dotContainer
// @input Asset.ObjectPrefab dotPrefab
//@input Component.ScriptComponent shapeController
//@input float dotSizeMultiplier = 2.0 {"hint":"Dot diameter as a multiple of edgeTolerance (the shape's stroke half-width), so dots visually match the line thickness at any screen size or shape."}
//@input float pendingDotAlpha = 0.32 {"hint":"Opacity the dim \"missing segment\" markers fade in to once the player seems stuck. Set to 0 to disable the feature entirely."}
//@input float stallSeconds = 3.0 {"hint":"How long the player can go without tracing a new segment before the dim markers start fading in."}
//@input float fadeInDuration = 0.6 {"hint":"How long the fade-in itself takes once the stall threshold is reached."}

var dotObjects = [];
var dotTraced = []; // parallel to dotObjects — true once that segment has been traced, so the stall fade never touches it
var dotLocalSize = null; // cached per-shape; same for every dot since edgeTolerance is shape-wide
var lastProgressTime = 0; // getTime() of the last successfully traced segment (or round start)
var lastAppliedFadeT = -1; // avoids rewriting every dot's alpha every single frame once settled

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

// Sets a dot's opacity without touching any other dot — each dot gets its
// own cloned material in initDotPool() specifically so this is safe; they'd
// otherwise all share the prefab's one material instance and dim/brighten
// together.
function setDotAlpha(dot, alpha) {
    var image = dot.getComponent("Component.Image");
    if (image) {
        image.mainPass.baseColor = new vec4(1, 1, 1, alpha);
    }
}

function initDotPool() {
    // Clear out any dots from a previous shape (e.g. if you rebuild at runtime)
    for (var i = 0; i < dotObjects.length; i++) {
        dotObjects[i].destroy();
    }
    dotObjects = [];
    dotTraced = [];
    lastProgressTime = getTime();
    lastAppliedFadeT = -1;

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

    if (!containerST) {
        print("ERROR: dotContainer needs a Component.ScreenTransform attached to it (Add Component > Screen Transform in the Inspector)");
    }

    // Spawn exactly as many dots as this shape's perimeter needs, and place
    // every one of them right away — invisible for now, since nobody's
    // stuck yet. updateStallFade() fades the untraced ones in once the
    // player goes stallSeconds without tracing a new segment.
    var perimeterPoints = script.shapeController.perimeterPoints;
    var count = perimeterPoints.length;
    for (var i = 0; i < count; i++) {
        var dot = script.dotPrefab.instantiate(script.dotContainer);
        var image = dot.getComponent("Component.Image");
        if (image) {
            image.mainMaterial = image.mainMaterial.clone();
        }

        if (containerST) {
            var localPos = containerST.worldPointToLocalPoint(perimeterPoints[i]);
            var st = dot.getComponent("Component.ScreenTransform");
            st.anchors.setCenter(localPos);
            if (dotLocalSize) {
                st.anchors.setSize(dotLocalSize);
            }
        }

        setDotAlpha(dot, 0);
        dot.enabled = true;
        dotObjects.push(dot);
        dotTraced.push(false);
    }
    print("Dot pool ready: " + dotObjects.length + " dots (missing-segment hint fades in after " + script.stallSeconds + "s stuck)");
}

function placeDot(index) {
    if (index >= dotObjects.length) return;
    setDotAlpha(dotObjects[index], 1.0);
    dotTraced[index] = true;
    // Fresh progress — stop showing the "you're stuck" hint until the next lull.
    lastProgressTime = getTime();
}

// Runs every frame: once the player has gone stallSeconds without tracing a
// new segment, fade the still-untraced dots in from invisible up to
// pendingDotAlpha over fadeInDuration. Resets (and hides them again) the
// instant placeDot() marks fresh progress.
function updateStallFade() {
    if (script.pendingDotAlpha <= 0 || dotObjects.length === 0) return;

    var stalledFor = getTime() - lastProgressTime - script.stallSeconds;
    var t = script.fadeInDuration > 0
        ? Math.max(0, Math.min(1, stalledFor / script.fadeInDuration))
        : (stalledFor >= 0 ? 1 : 0);

    if (Math.abs(t - lastAppliedFadeT) < 0.004) return; // no visible change — skip the per-dot loop
    lastAppliedFadeT = t;

    var alpha = t * script.pendingDotAlpha;
    for (var i = 0; i < dotObjects.length; i++) {
        if (!dotTraced[i]) {
            setDotAlpha(dotObjects[i], alpha);
        }
    }
}

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(updateStallFade);

script.init = function () {
    initDotPool();
};

script.placeDot = placeDot;