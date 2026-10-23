//@component
// LifeLostPopup.js
//@input SceneObject popupRoot
//@input Component.Text livesRemainingText
//@input float displaySeconds = 1.2

function show(livesRemaining) {
    if (script.livesRemainingText) {
        script.livesRemainingText.text = livesRemaining + (livesRemaining === 1 ? " life remaining" : " lives remaining");
    }
    script.popupRoot.enabled = true;

    var delayed = script.createEvent("DelayedCallbackEvent");
    delayed.bind(function () {
        script.popupRoot.enabled = false;
    });
    delayed.reset(script.displaySeconds);
};


function hide(){
    script.popupRoot.enabled = false;
}

script.show = show
script.hide = hide
