(function($) {
    var shouldHandleKeyDown = true;

    document.onkeydown = function(event) {
        // Avoid repetitive events on a key being pressed
        if(!shouldHandleKeyDown)
            return;
        shouldHandleKeyDown = false;

        var charCode = (event.which) ? event.which : event.keyCode;
        var keyInput = String.fromCharCode(charCode);
        // Key down event.
        // console.log("key down " + keyInput);
        
        // n for Next button click
        if((charCode === 16) && !($("#next").is(":disabled"))) {
            event.preventDefault();
            $("#next").click();
        }

        // b for Back button click
        if((keyInput == 'B' || keyInput == 'b') && !($("#back").is(":disabled"))) {
            $("#back").click();
        }

        // y for I am in! button click
        if((keyInput == 'Y' || keyInput == 'y') && !($("#startTest").is(":disabled"))) {
            $("#startTest").click();
        }
    };

    document.onkeyup = function(event) {

        shouldHandleKeyDown = true;

        var charCode = (event.which) ? event.which : event.keyCode;
        var keyInput = String.fromCharCode(charCode);
        // Key up event.
        // console.log("key up " + event.keyCode);

        // n for Next button click
        if((charCode === 16) && !($("#next").is(":disabled"))) {
            event.preventDefault();
            $("#next").click();
        }
    };

})(jQuery);
