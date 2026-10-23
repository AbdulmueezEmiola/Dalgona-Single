//@component
// SquareToStage.js
// Makes ShapeBox a square sized to the smaller dimension of its parent Stage.

// @input Component.ScreenTransform shapeBoxTransform
// @input Component.ScreenTransform stageTransform
// @input float padding = 0.9 {"hint":"1.0 = fills the smaller side exactly, 0.9 = 90% with a margin"}

function resizeToSquare() {
    var topRight   = script.stageTransform.localPointToWorldPoint(new vec2(1, 1));
    var bottomLeft = script.stageTransform.localPointToWorldPoint(new vec2(-1, -1));

    var stageWidth  = Math.abs(topRight.x - bottomLeft.x);
    var stageHeight = Math.abs(topRight.y - bottomLeft.y);
    var side = Math.min(stageWidth, stageHeight) * script.padding;
    
    // Collapse anchors to a center point so offsets (world units) fully control size
    script.shapeBoxTransform.anchors.setCenter(new vec2(0, 0));
    script.shapeBoxTransform.anchors.setSize(new vec2(0, 0));

    script.shapeBoxTransform.offsets.setCenter(new vec2(0, 0));
    script.shapeBoxTransform.offsets.setSize(new vec2(side, side));
}

resizeToSquare();