(function($) {
    var shouldHandleKeyDown = true;

    // document.onkeypress = function(event) {
    //   var charCode = (event.which) ? event.which : event.keyCode;
    //   var keyInput = String.fromCharCode(charCode);
    //   // Key press event.
    //   console.log("key press " + keyInput);
    //
    // };

    document.onkeydown = function(event) {

        // Avoid repetitive events on a key being pressed
        if(!shouldHandleKeyDown)
            return;
        shouldHandleKeyDown = false;

        var charCode = (event.which) ? event.which : event.keyCode;
        var keyInput = String.fromCharCode(charCode);
        // Key down event.
        console.log("key down " + keyInput);

        // t for Test Noise button
        if((keyInput == 'T' || keyInput == 't') && !($("#noiseTestBtn").is(":disabled"))) {
            $("#noiseTestBtn").click();
        }

        // n for Next button click
        if((keyInput == 'N' || keyInput == 'n')   && !($("#next").is(":disabled"))) {
            $("#next").click();
        }

        // b for Back button click
        if((keyInput == 'B' || keyInput == 'b') && !($("#back").is(":disabled"))) {
            $("#back").click();
        }
    };

    document.onkeyup = function(event) {

        shouldHandleKeyDown = true;

        var charCode = (event.which) ? event.which : event.keyCode;
        var keyInput = String.fromCharCode(charCode);
        // Key up event.
        console.log("key up " + event.keyCode);

        // t for Test Noise button
        if((keyInput == 'T' || keyInput == 't') && !($("#noiseTestBtn").is(":disabled"))) {
            $("#noiseTestBtn").click();
        }

        // n for Next button click
        if((keyInput == 'N' || keyInput == 'n')   && !($("#next").is(":disabled"))) {
            $("#next").click();
        }
    };

})(jQuery);
