(function($) {
    var shouldHandleKeyDown = true;

    document.onkeypress = function(event) {

    };

    document.onkeydown = function(event) {

        // Avoid repetitive events on a key being pressed
        if(!shouldHandleKeyDown)
            return;
        shouldHandleKeyDown = false;

        // Key down event.
        console.log("key down " + event.keyCode);
        if(event.keyCode == "65") {
            $("#noiseTestBtn").click();
        }

        if(event.keyCode == "78") {
            $("#next").click();
        }
    };

    document.onkeyup = function(event) {

        shouldHandleKeyDown = true;
        // Key up event.
        console.log("key up " + event.keyCode);
        if(event.keyCode == "65") {
            $("#noiseTestBtn").click();
        }

        if(event.keyCode == "78") {
            $("#next").click();
        }
    };

})(jQuery);
