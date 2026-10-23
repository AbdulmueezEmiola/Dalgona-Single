//@component
// GameOverScreen.js
//@input SceneObject gameOverRoot
//@input Component.Text finalScoreText
//@input Component.Text bestScoreText
//@input SceneObject newBestBadge {"hint":"Optional — e.g. a 'NEW BEST!' label/graphic, enabled only when this run beat the previous high score."}
//@input Component.ScriptComponent leaderboardComponent {"hint":"Optional — the Leaderboard custom component (under Orthographic Camera). When set, every run's score is submitted here; its own End State setting controls whether it pops up automatically."}

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

    if (script.leaderboardComponent && script.leaderboardComponent.submitScore) {
        script.leaderboardComponent.submitScore(finalScore);
    }
};

script.hide = function () {
    script.gameOverRoot.enabled = false;

    if (script.leaderboardComponent && script.leaderboardComponent.hide) {
        script.leaderboardComponent.hide();
    }
};