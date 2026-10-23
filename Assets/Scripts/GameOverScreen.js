//@component
// GameOverScreen.js
//@input SceneObject gameOverRoot
//@input Component.Text finalScoreText
//@input Component.Text bestScoreText
//@input SceneObject newBestBadge {"hint":"Optional — e.g. a 'NEW BEST!' label/graphic, enabled only when this run beat the previous high score."}

script.show = function (finalScore, isNewBest) {
    script.gameOverRoot.enabled = true;

    if (script.finalScoreText) {
        script.finalScoreText.text = "Score: " + finalScore;
    }

    if (script.bestScoreText) {
        var best = global.persistentStorageSystem.store.getInt("singlePlayerHighScore") || 0;
        script.bestScoreText.text = "Best: " + best;
    }

    if (script.newBestBadge) {
        script.newBestBadge.enabled = !!isNewBest;
    }
};

script.hide = function () {
    script.gameOverRoot.enabled = false;
};