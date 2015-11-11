(function($) {

    $(document).ready(function() {

        window.speechRecognition = window.speechRecognition || window.webkitSpeechRecognition;
        
        if(!('speechSynthesis' in window && 'speechRecognition' in window)){
            alert("Web Speech API not supported in your browser. Please use latest Chrome for better experience.");
            return;
        }

        try {
            var recognition = new speechRecognition();
        } catch(e) {
            var recognition = Object;
        }
        recognition.continuous = true;
        recognition.interimResults = true;
        var recognizing = false;

        var interimResult = '';
        var textArea = $('#speech-page-content');
        var textAreaID = 'speech-page-content';

        /*Play audio of example sentences */

        var voiceSelect = null;
        var voices = speechSynthesis.getVoices();
        /*Record the audio and save the audio*/

        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        var audioContext = new AudioContext();
        var audioInput = null,
            realAudioInput = null,
            inputPoint = null,
            audioRecorder = null;
        var rafID = null;
        var analyserContext = null;
        var canvasWidth, canvasHeight;
        var recIndex = 0;

        var sentenceId = 1;
        var sentenceDic = null;
        var selectedSentences = null;
        var sentenceNumOnPage = 1;
        var startPos = 3;
        var updateAnalysers = function (time) {
            // if (!analyserContext) {
            //     var canvas = document.getElementById("analyser");
            //     canvasWidth = canvas.width;
            //     canvasHeight = canvas.height;
            //     analyserContext = canvas.getContext('2d');
            // }

            // /*TODO: Enable the draw code here.*/
            // // analyzer draw code here
            // {
            //     var SPACING = 3;
            //     var BAR_WIDTH = 1;
            //     var numBars = Math.round(canvasWidth / SPACING);
            //     var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

            //     analyserNode.getByteFrequencyData(freqByteData); 

            //     analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
            //     analyserContext.fillStyle = '#F6D565';
            //     analyserContext.lineCap = 'round';
            //     var multiplier = analyserNode.frequencyBinCount / numBars;

            //     // Draw rectangle for each frequency bin.
            //     for (var i = 0; i < numBars; ++i) {
            //         var magnitude = 0;
            //         var offset = Math.floor( i * multiplier );
            //         // gotta sum/average the block, or we miss narrow-bandwidth spikes
            //         for (var j = 0; j< multiplier; j++)
            //             magnitude += freqByteData[offset + j];
            //         magnitude = magnitude / multiplier;
            //         var magnitude2 = freqByteData[i * multiplier];
            //         analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
            //         analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
            //     }
            // }
            
            // rafID = window.requestAnimationFrame( updateAnalysers );
        };        

        var gotStream = function(stream) {
            inputPoint = audioContext.createGain();

            // Create an AudioNode from the stream.
            realAudioInput = audioContext.createMediaStreamSource(stream);
            audioInput = realAudioInput;
            audioInput.connect(inputPoint);

        //    audioInput = convertToMono( input );

            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 2048;
            inputPoint.connect( analyserNode );

            audioRecorder = new Recorder( inputPoint );

            zeroGain = audioContext.createGain();
            zeroGain.gain.value = 0.0;
            inputPoint.connect( zeroGain );
            zeroGain.connect( audioContext.destination );
            updateAnalysers();
        };    


        var doneEncoding = function ( blob ) {
            Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
            recIndex++;
        };

        var gotBuffers = function ( buffers ) {
            var canvas = document.getElementById( "wavedisplay" );

            /*Enable draw code here.*/
            // drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffers[0] );

            // the ONLY time gotBuffers is called is right after a new recording is completed - 
            // so here's where we should set up the download.
            audioRecorder.exportWAV( doneEncoding );
        };

        var toggleRecording = function ( e ) {
            if (e.classList.contains("recording")) {
                // stop recording
                audioRecorder.stop();
                e.classList.remove("recording");
                audioRecorder.getBuffers( gotBuffers );
            } else {
                // start recording
                if (!audioRecorder)
                    return;
                e.classList.add("recording");
                audioRecorder.clear();
                audioRecorder.record();
            }
        };

        var initAudio = function(){
            if(!navigator.getUserMedia)
                navigator.getUserMedia = navigator.webkitGetUserMedia;
            if(!navigator.cancelAnimationFrame)
                navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame;
            if(!navigator.requestAnimationFrame)
                navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame;
            navigator.getUserMedia(
                {
                    "audio": {
                        "mandatory": {
                            "googEchoCancellation": "false",
                            "googAutoGainControl": "false",
                            "googNoiseSuppression": "false",
                            "googHighpassFilter": "false"
                        },
                        "optional": []
                    },
                },
                gotStream,
                function(e){
                alert('Error Getting Audio!');
                console.log(e);
            });
        };

        var loadSentence = function(){
            $.get('js/speechRecognizer/harvsents.txt', function(sentence){
                sentenceDic = sentence.split("\n");
                showSentence(sentenceId);
            }, 'text');
        };
        var sendMail = function(to) {
            var link = "mailto:"  + to + 
                     + "?cc=hongkun@cs.unc.edu"
                     + "&subject=" + encodeURI("This is my subject")
                     + "&body=" + encodeURI($('#speech-page-content').val());

            window.location.href = link;
            return false;
        };

        var loadVoices = function(){
            voices = speechSynthesis.getVoices();
        };
        var speak = function(text){
            var msg = new SpeechSynthesisUtterance();
            

            // Set the attributes of voice;
            // msg.volume = parseFloat(volumeInput.value);
            // msg.rate = parseFloat(rateInput.value);
            // msg.pitch = parseFloat(pitchInput.value);

            // msg.voice = speechSynthesis.getVoices().filter(function(voice){
            //     return voice.name = "Google US English";
            // })[0];
            
            msg.voice = voices[1];
            console.log(msg.voice);
            msg.text = text;
            //msg.voiceURI = 'native';
            msg.volume = 1;
            msg.rate = 1;
            msg.pitch = 1;
            //queue the utterance.
            speechSynthesis.speak(msg);
        };

        initAudio();
        loadSentence();

        $('.speech-mic').click(function(){
            toggleRecording(this);
            if(recognizing){
                recognition.stop();
                return;
            }
            startRecognition();
        });

        var startRecognition = function() {
            textArea.focus();
            recognition.start();
        };


        recognition.onstart = function(){
            recognizing = true;
            $('.speech-content-mic').addClass('speech-mic-works');
        };
        recognition.onresult = function (event) {
            var pos = textArea.getCursorPosition() - interimResult.length;
            textArea.val(textArea.val().replace(interimResult, ''));
            interimResult = '';
            textArea.setCursorPosition(pos);
            for (var i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    insertAtCaret(textAreaID, event.results[i][0].transcript);
                } else {
                    isFinished = false;
                    insertAtCaret(textAreaID, event.results[i][0].transcript + '\u200B');
                    interimResult += event.results[i][0].transcript + '\u200B';
                }
            }
        };

        recognition.onend = function() {
            recognizing = false;
            $('.speech-content-mic').removeClass('speech-mic-works');
        };

        var showSentence = function(sentenceId){
            sentenceId = parseInt(sentenceId);
            var start = sentenceId + (sentenceId - 1) * 10;
            var end = start + sentenceNumOnPage;
            selectedSentences = sentenceDic.slice(start, end);
            selectedSentences = selectedSentences.slice(startPos, selectedSentences.length);
            $("#sentenceSpeak").val(selectedSentences);
            // selectedSentences = sentenceDic.slice(start, end).join("<br>");
            $("#sentenceShow").html(selectedSentences);
        };

        
        $("#sentenceId").change(function(){
            sentenceId = $(this).val();
            showSentence(sentenceId);
        });

        $("#email").click(function(){
            sendMail('hongkun@cs.unc.edu');
        });


        /*Play audio of sentence as an example*/
        
        $("#play").click(function(){
            
            speak($("#sentenceSpeak").val());
        });

        loadVoices();
        window.speechSynthesis.onvoiceschanged = function(e) {
            loadVoices();
        };
    });
})(jQuery);