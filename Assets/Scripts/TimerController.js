//@component
// TimerController.js
// Counts DOWN from startTime and fires script.onTimeUp() once when it
// reaches zero. (Previously this counted UP from 0 and ignored startTime
// entirely — fixed here so a real countdown challenge is possible.)

// @input Component.Text timerText
// @input float startTime = 30.0

var timeLeft = 0;
var isRunning = false;
var hasFiredTimeUp = false;

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(function () {
    if (!isRunning) return;

    timeLeft -= getDeltaTime();

    if (timeLeft <= 0) {
        timeLeft = 0;
        isRunning = false;
        updateDisplay();
        if (!hasFiredTimeUp) {
            hasFiredTimeUp = true;
            if (script.onTimeUp) script.onTimeUp();
        }
        return;
    }

    updateDisplay();
});

function updateDisplay() {
    var seconds = Math.ceil(timeLeft);
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    var secsStr = secs < 10 ? "0" + secs : "" + secs;
    script.timerText.text = mins + ":" + secsStr;
}

// Starts (or restarts) the countdown. Pass an override in seconds, or omit
// to use the startTime input.
script.startCountdown = function (overrideSeconds) {
    timeLeft = (overrideSeconds !== undefined && overrideSeconds !== null)
        ? overrideSeconds
        : script.startTime;
    isRunning = true;
    hasFiredTimeUp = false;
    updateDisplay();
};

// Pauses the countdown without resetting timeLeft (e.g. game over).
script.stopTimer = function () {
    isRunning = false;
};

// Resets to startTime and stays paused until startCountdown() is called.
script.resetTimer = function () {
    timeLeft = script.startTime;
    isRunning = false;
    hasFiredTimeUp = false;
    updateDisplay();
};

script.getTimeLeft = function () {
    return timeLeft;
};

// Assign this from SinglePlayerController: script.timerController.onTimeUp = fn
script.onTimeUp = null;