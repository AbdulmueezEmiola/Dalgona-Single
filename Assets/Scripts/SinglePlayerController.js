//@component
// SinglePlayerController.js
// Drop this into GameController's `turnController` input slot instead of
// TurnController — it exposes the same loseLife()/roundCompleted(success)
// interface, so GameController.js needs no changes at all.
//
// SOFT-FAIL DESIGN: running out of lives does NOT end the run. It skips
// the current shape (no score for it), refills lives, and drops you into
// the next shape after a brief pause. The ONLY thing that ends the run is
// the countdown timer reaching zero. Score = shapes successfully traced.

//@input Component.ScriptComponent gameController
//@input Component.ScriptComponent shapeController
//@input Component.ScriptComponent timerController {"hint":"Optional — omit to play lives-only with no clock (run would then never end on its own)."}
//@input Component.ScriptComponent gameOverScreen {"hint":"Script on your game-over popup exposing show(finalScore, isNewBest) and hide()."}
//@input Component.ScriptComponent shapeFailedPopup {"hint":"Optional — script exposing show(), shown briefly when lives run out and the current shape is skipped."}
//@input Component.Text livesText
//@input Component.Text scoreText
//@input int startingLives = 3
//@input float timeLimitSeconds = 30.0 {"hint":"Overall countdown for the whole run. Passed into timerController.startCountdown() as the single source of truth, independent of the timer's own startTime field."}
//@input float shapeFailedPauseSeconds = 1.0 {"hint":"How long to hold on the failed shape (and show shapeFailedPopup, if wired) before moving on to the next one."}

var HEART_CHAR = "❤️"; // keep in sync with TurnController.js if you reuse both

var HIGH_SCORE_KEY = "singlePlayerHighScore";

var lives = 0;
var score = 0;
var shapeBag = [];
var isGameOver = true;
var currentShapeIndex = -1;

// Fisher-Yates shuffle of 0..count-1 (same approach as TurnController.js)
function shuffledIndices(count) {
    var arr = [];
    for (var i = 0; i < count; i++) arr.push(i);
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

// Endless: draws from a shuffled bag so you see every shape once before
// any repeat, then reshuffles and keeps going.
function nextShapeIndex() {
    if (shapeBag.length === 0) {
        var poolSize = script.shapeController.getPoolSize ? script.shapeController.getPoolSize() : 0;
        shapeBag = shuffledIndices(poolSize);
    }
    return shapeBag.pop();
}

function updateLivesDisplay() {
    if (!script.livesText) return;
    var hearts = "";
    for (var i = 0; i < lives; i++) hearts += HEART_CHAR;
    script.livesText.text = hearts;
}

function updateScoreDisplay() {
    if (script.scoreText) script.scoreText.text = "" + score;
}

function startRound() {
    currentShapeIndex = nextShapeIndex();
    script.gameController.startRound(currentShapeIndex);
}

function getHighScore() {
    return global.persistentStorageSystem.store.getInt(HIGH_SCORE_KEY) || 0;
}

// Returns true if this run set a new high score.
function checkAndStoreHighScore(finalScore) {
    var best = getHighScore();
    if (finalScore > best) {
        global.persistentStorageSystem.store.putInt(HIGH_SCORE_KEY, finalScore);
        return true;
    }
    return false;
}

function startGame() {
    isGameOver = false;
    lives = script.startingLives;
    score = 0;
    shapeBag = [];
    updateLivesDisplay();
    updateScoreDisplay();

    if (script.timerController) {
        script.timerController.onTimeUp = onTimeUp;
        script.timerController.startCountdown(script.timeLimitSeconds);
    }

    startRound();
}

// The only way the run actually ends: the clock hitting zero.
function endGame() {
    if (isGameOver) return;
    isGameOver = true;

    if (script.timerController) script.timerController.stopTimer();

    var isNewBest = checkAndStoreHighScore(score);

    if (script.gameOverScreen && script.gameOverScreen.show) {
        script.gameOverScreen.show(score, isNewBest);
    } else {
        print("Game over — final score: " + score);
    }
}

function onTimeUp() {
    endGame();
}

// Called by GameController when the player finishes tracing the current
// shape. Immediately queues the next one.
function roundCompleted(success) {
    if (isGameOver) return;

    if (success) {
        score += 1;
        updateScoreDisplay();
    }

    startRound();
}

// Called by GameController each time the needle drifts off the shape long
// enough to count as a fail.
//
// IMPORTANT ordering note: when lives hit zero we return {roundOver:true}
// so GameController marks its own round as over — but GameController does
// that check AFTER this function returns. So the transition to the next
// shape (which needs GameController's startRound() to flip its internal
// isGameOver back to false) has to happen on a LATER frame, or Game-
// Controller's post-return "isGameOver = true" would immediately stomp on
// it. Hence the DelayedCallbackEvent below instead of calling startRound()
// synchronously here.
function loseLife() {
    if (isGameOver) return { roundOver: true, livesRemaining: lives };

    lives -= 1;
    updateLivesDisplay();

    if (lives <= 0) {
        // Soft fail: skip this shape, refill lives, move on — the run
        // itself keeps going. No score awarded for the skipped shape.
        lives = script.startingLives;
        updateLivesDisplay();

        if (script.shapeFailedPopup && script.shapeFailedPopup.show) {
            script.shapeFailedPopup.show();
        }

        var delayed = script.createEvent("DelayedCallbackEvent");
        delayed.bind(function () {
            if (!isGameOver) startRound();
        });
        delayed.reset(script.shapeFailedPauseSeconds);

        return { roundOver: true, livesRemaining: script.startingLives };
    }

    return { roundOver: false, livesRemaining: lives };
}

script.startGame = startGame;
script.roundCompleted = roundCompleted;
script.loseLife = loseLife;
script.getHighScore = getHighScore;

var startEvent = script.createEvent("OnStartEvent");
startEvent.bind(function () {
    startGame();
});