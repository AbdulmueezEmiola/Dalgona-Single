//@component
// Restart.js
//@input Component.ScriptComponent singlePlayerController
//@input Component.ScriptComponent gameOverScreen
//@input Component.ScriptComponent leaderboardComponent {"hint":"Optional — the Leaderboard custom component. Its card sits on top of this button; a plain TapEvent fires on any tap inside this button's rect regardless of what's drawn over it, so a tap meant to dismiss the leaderboard would otherwise also restart. This skips the restart while the leaderboard is visible, or just after it closes."}

// The leaderboard's own dismiss-by-tapping-outside uses Lens Studio's
// depth-aware InteractionComponent, while this button uses a plain TapEvent
// (no concept of what's drawn on top of it). Both can fire for the same
// physical tap with no guaranteed order between the two systems, so
// `visible` alone can't be trusted mid-dismiss — it may have already
// flipped to false by the time this handler runs. The short cooldown after
// onHide covers that race regardless of which system resolves first.
var DISMISS_GUARD_SECONDS = 0.35;
var leaderboardDismissedAt = -1;

if (script.leaderboardComponent && script.leaderboardComponent.onHide && script.leaderboardComponent.onHide.add) {
    script.leaderboardComponent.onHide.add(function () {
        leaderboardDismissedAt = getTime();
    });
}

var tapEvent = script.createEvent("TapEvent");

tapEvent.bind(function () {
    var leaderboardIsOpen = script.leaderboardComponent && script.leaderboardComponent.visible;
    var leaderboardJustClosed = leaderboardDismissedAt >= 0 && (getTime() - leaderboardDismissedAt) < DISMISS_GUARD_SECONDS;

    if (leaderboardIsOpen || leaderboardJustClosed) {
        return;
    }

    print("✅ Restart tapped");

    if (script.gameOverScreen && script.gameOverScreen.hide) {
        script.gameOverScreen.hide();
    }

    if (script.singlePlayerController && script.singlePlayerController.startGame) {
        script.singlePlayerController.startGame();
    }
}); 