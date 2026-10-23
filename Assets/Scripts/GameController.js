//@component
// GameLogic.js
//@input Component.ScriptComponent shapeController
//@input Component.ScriptComponent dotController
//@input Component.ScriptComponent needleCursor
//@input Component.ScriptComponent turnController
//@input Component.Text progressText
//@input float failDebounceSeconds = 0.18 {"hint":"How long the needle must stay outside failTolerance before it counts as going off the shape (prevents one noisy touch sample from costing a life)."}
//@input float failGraceSeconds = 1.0 {"hint":"Brief invulnerability window right after losing a life, giving the player a moment to steer back onto the line before fail-detection resumes."}
//@input Component.ScriptComponent lifeLostPopup {"hint":"Optional — a script on your popup SceneObject exposing show(livesRemaining). GameController just triggers it; the popup handles its own animation/auto-hide timing."}
//@input bool forceStandaloneTest = false {"hint":"TESTING ONLY — force-starts a round on launch even when a TurnController is wired in, so you can iterate in Lens Studio Preview without a live paired match. Turn this OFF before publishing."}
//@input int testShapeIndex = -1 {"hint":"TESTING ONLY — when forceStandaloneTest is on, set this to a specific index in shapeVerticesPool (e.g. 10 for rocket) to always load THAT shape instead of a random one. Leave at -1 for random."}

var isGameOver = false;
var visitedSegments = [];
var offTargetSince = null;
var invulnerableUntil = 0;
var lastGoodPos = null; // most recent perimeter point the needle was genuinely on-target at


function resetVisitedSegments() {
    visitedSegments = [];
    for (var i = 0; i < script.shapeController.perimeterPoints.length; i++) {
        visitedSegments.push(false);
    }
}


function getProgress() {
    var visited = 0;
    for (var i = 0; i < visitedSegments.length; i++) {
        if (visitedSegments[i]) visited++;
    }
    return visited / visitedSegments.length;
}


function updateProgressDisplay() {
    if (!script.progressText) return;
    var pct = Math.round(getProgress() * 100);
    script.progressText.text = pct + "%";
}


function onNeedleMove(pos){
    if (isGameOver) return;

    var nearest = script.shapeController.getNearestSegment(pos);

    if (nearest.dist > script.shapeController.failTolerance) {
        var now = getTime();

        if (now < invulnerableUntil) {
            // Just lost a life — brief grace period so the player has a
            // moment to steer back before another life can be lost.
            return;
        }

        // Debounced so a single noisy touch sample doesn't instantly cost
        // a life — it has to stay out here continuously for
        // failDebounceSeconds.
        if (offTargetSince === null) {
            offTargetSince = now;
        } else if (now - offTargetSince >= script.failDebounceSeconds) {
            offTargetSince = null;

            var result = script.turnController.loseLife();
            if (result.roundOver) {
                // All lives gone — the round (and the match) is over.
                isGameOver = true;
            } else {
                // Still has lives left — keep tracing the SAME shape,
                // just give a moment before another fail can register.
                invulnerableUntil = now + script.failGraceSeconds;

                // Snap the needle back to where it last actually was on
                // the line, rather than leaving it sitting off in the
                // fail zone (which would just cause an immediate re-fail
                // once the grace period ends).
                if (lastGoodPos) {
                    script.needleCursor.placeNeedleAtWorldPoint(lastGoodPos);
                }

                if (script.lifeLostPopup && script.lifeLostPopup.show) {
                    script.lifeLostPopup.show(result.livesRemaining);
                }
            }
        }
        return;
    }

    // Anything at or inside failTolerance clears the fail timer — this
    // includes the grace zone between edgeTolerance and failTolerance,
    // which is intentionally neutral: no progress, no penalty.
    offTargetSince = null;

    if (nearest.dist < script.shapeController.edgeTolerance) {
        lastGoodPos = script.shapeController.perimeterPoints[nearest.index];

        if (!visitedSegments[nearest.index]) {
            visitedSegments[nearest.index] = true;
            script.dotController.placeDot(nearest.index);
            updateProgressDisplay();

            if (getProgress() >= 1) {
                isGameOver = true;
                script.turnController.roundCompleted(true);
            }
        }
    }
}

// Called from NeedleCursor on TouchStartEvent so a stale fail-timer from a
// previous drag session can't carry over into a new one.
function resetFailTracking() {
    offTargetSince = null;
}

// Sets up a fresh round: new shape geometry (by pool index), dot pool, and
// needle start position. Called once at lens start (standalone fallback)
// AND at the top of every turn via TurnController.
function startRound(shapeIndex) {
    // TESTING: if a specific shape is pinned, it wins no matter who called
    // startRound — including TurnController, if onTurnStart also fires
    // while forceStandaloneTest is on (which can happen once your turn
    // flow is actually working, and would otherwise silently overwrite
    // this with whatever random shape the turn drew).
    if (script.forceStandaloneTest && script.testShapeIndex >= 0) {
        shapeIndex = script.testShapeIndex;
    }

    isGameOver = false;
    offTargetSince = null;
    invulnerableUntil = 0;
    lastGoodPos = null;
    // Explicit order matters: shape geometry must exist before dots are
    // spawned and before the needle can compute its starting offset.
    script.shapeController.init(shapeIndex);
    script.dotController.init();
    script.needleCursor.init();
    resetVisitedSegments();
    updateProgressDisplay();

    // Seed a fallback so a fail before the player ever touches the line
    // still has somewhere to snap back to (the needle's own start point).
    if (script.needleCursor.startVertexIndex !== undefined) {
        lastGoodPos = script.shapeController.SHAPE_VERTICES[script.needleCursor.startVertexIndex];
    }
}

var startEvent = script.createEvent("OnStartEvent");
startEvent.bind(function () {
    // If a TurnController is wired in, IT drives round starts via
    // onTurnStart. Auto-starting here too would call startRound() twice in
    // a row at launch, which corrupts the needle's calibration on the
    // second call — so normally we skip self-starting when a
    // TurnController is present. forceStandaloneTest overrides that for
    // Preview/dev iteration when onTurnStart isn't firing.
    if (!script.turnController || script.forceStandaloneTest) {
        var poolSize = script.shapeController.getPoolSize ? script.shapeController.getPoolSize() : 0;

        if (poolSize > 0) {
            if (script.testShapeIndex >= 0 && script.testShapeIndex < poolSize) {
                // Testing a specific shape — always load this exact index.
                startRound(script.testShapeIndex);
            } else {
                // Exercise the actual pool (vertices + texture swap) during
                // solo testing too, instead of always falling back to the
                // single default shapeVertices field.
                startRound(Math.floor(Math.random() * poolSize));
            }
        } else {
            startRound();
        }
    }
});

script.onNeedleMove = onNeedleMove;
script.startRound = startRound;
script.resetFailTracking = resetFailTracking;