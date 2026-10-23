//@component
// ShapeFailedPopup.js
//@input SceneObject popupRoot
//@input float displaySeconds = 1.0 {"hint":"Should roughly match SinglePlayerController's shapeFailedPauseSeconds so the popup disappears right as the next shape loads."}

function show() {   
    script.popupRoot.enabled = true;

    var delayed = script.createEvent("DelayedCallbackEvent");
    delayed.bind(function () {
        script.popupRoot.enabled = false;
    });
    delayed.reset(script.displaySeconds);
}

function hide() {
    script.popupRoot.enabled = false;
}

script.show = show;
script.hide = hide;