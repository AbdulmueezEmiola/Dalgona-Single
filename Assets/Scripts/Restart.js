//@component
// Restart.js
//@input Component.ScriptComponent singlePlayerController
//@input Component.ScriptComponent gameOverScreen

var tapEvent = script.createEvent("TapEvent");

tapEvent.bind(function () {
    print("✅ Restart tapped");

    if (script.gameOverScreen && script.gameOverScreen.hide) {
        script.gameOverScreen.hide();
    }

    if (script.singlePlayerController && script.singlePlayerController.startGame) {
        script.singlePlayerController.startGame();
    }
}); 