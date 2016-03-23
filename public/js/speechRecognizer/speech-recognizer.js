(function($) {

    $(document).ready(function() {
        navigator.getUserMedia = (navigator.getUserMedia ||
                                  navigator.webkitGetUserMedia ||
                                  navigator.mozGetUserMedia ||
                                  navigator.msGetUserMedia);

        var audioContext = new (window.AudioContext || window.webkitAudioContext)();

        var source;
        var stream;
        var analyzer = audioContext.createAnalyser();
        var gainNode = audioContext.createGain();
        var audioRecorder = null;
        var recIndex = 0;

        var token = null;
        var wsURI = "wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token=";
        var webSocket = null;

        var startSig = {"action": "start", "content-type": "audio/wav;rate=22050"};
        var stopSig = {"action": "stop"};

        var selectedSentences;             // selected sentence group.
        var sentenceNumInGroup = 10;
        var sentenceGroupId = 1;
        var sentenceId = 1;
        var startPos = 3;

        var totalScore = 0;
        var report = {
            'emptyResultsReturned': 0,
            'sentenceCount': 0,
            'average': 0,
            'results':[]
        };

        var getStream = function(stream){
            gainNode.gain.value = 0;

            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyzer);
            analyzer.connect(gainNode);
            gainNode.connect(audioContext.destination);

            audioRecorder = new Recorder(source);
        };

        var doneEncoding = function ( blob ) {

            console.log('Making request to Watson......');

            websocket.send(blob);
            setTimeout(function(){
                websocket.send(JSON.stringify(stopSig));
            }, 1500);



            Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
            recIndex++;
        };

        var gotBuffers = function ( buffers ) {
            // the ONLY time gotBuffers is called is right after a new recording is completed -
            // so here's where we should set up the download.
            audioRecorder.exportWAV( doneEncoding );
        };

        var initialAudio = function() {
            if(navigator.getUserMedia) {
                console.log('GetUserMedia Supported!');
                navigator.getUserMedia(
                {
                    audio: true
                },

                //Successful Callback
                getStream,

                // Error Callback
                function(err){
                    console.log('Following Error occured:' + err);
                });
            } else {
                console.log('getUserMedia Not Supported!');
            }
        };

        var loadSentence = function(){
            $.get('js/speechRecognizer/harvsents.txt', function(sentence){
                // load a group of sentences into variable sentenceDic.
                var sentenceDic = sentence.split("\n");

                sentenceGroupId = parseInt(sentenceGroupId);
                var start = sentenceGroupId + (sentenceGroupId - 1) * 10;
                var end = start + sentenceNumInGroup;
                // only get the first sentence.
                selectedSentences = sentenceDic.slice(start, end);
            }, 'text');
        };

        var showSentence = function( id ) {
            $('#sentenceShow').html(selectedSentences[id]);
        };

        // Use edit distance between the two sentences to calculate the similarity value.
        var sentenceScore = function(stRecogized, stOriginal){
            var recognized = stRecogized.toLowerCase();
            recognized = $.trim(recognized);
            recognized = recognized.trim(" .");

            var original = stOriginal.toLowerCase();
            // eliminate the first number char.
            original = $.trim(original).slice(startPos, original.length);
            original = original.trim(" ").replace(/\.$/, "");

            // Get the edit distance between the two sentences.
            var dp = new Array(original.length + 1);
            for(var i = 0; i <= original.length; i ++){
                dp[i] = new Array(recognized.length + 1);
                dp[i][0] = i;
            }

            for(var j = 0; j <= recognized.length; j ++){
                dp[0][j] = j;
            }

            for(var i = 0; i < original.length; i ++){
                for(var j = 0; j < recognized.length; j ++){
                    if(original[i] == recognized[j]){
                        dp[i + 1][j + 1] = dp[i][j];
                    }else{
                        dp[i + 1][j + 1] = Math.min(dp[i + 1][j], dp[i][j + 1], dp[i][j]) + 1;
                    }
                }
            }
            var scoreFinal = Math.floor((original.length - dp[original.length][recognized.length]) / original.length * 100);
            return scoreFinal;
        }

        var onMessage = function (evt) {
            console.log("onMessage: recognition result in json format: " + evt.data);

            // 'Next ?/10' button should be disabled before the results messages are received.
            var evtData = $.parseJSON(evt.data);
            if('results' in evtData){

                // All all the details to the report.
                if(evtData['results'].length == 0) {
                    // Sometimes results is empty. Eliminate this one.
                    report['emptyResultsReturned'] ++;
                } else {
                    report['sentenceCount'] ++;
                    var stRecogized = evtData['results'][0]['alternatives'][0]['transcript'];
                    var stOriginal = selectedSentences[sentenceId - 1];

                    var item = {
                        'originalSentence': stOriginal,
                        'recogizedSentence': stRecogized,
                        'score': sentenceScore(stRecogized, stOriginal)
                    };
                    report['results'].push(item);
                    totalScore += item['score'];
                }

                // When sentenceId == 10, we won't enable 'Next' Button, but switch to ''GetReport' button and enable it.
                sentenceId++;
                if(sentenceId == 10) {
                    report['average'] = Math.round(totalScore / report['sentenceCount']);
                }
                $('#next').prop('disabled', false);
            }
        };

        var onClose = function(evt) {
            console.log("Connection is Closed!");
        };

        var onOpen = function(evt) {
            console.log("Connection is Open!");
        };

        var getToken = function(){
            $.ajax({
                type: 'GET',
                url: '/token',
                success: function (data, text) {
                    console.log(data);
                    token = data['token'];
                    wsURI = wsURI + token;
                    websocket = new WebSocket(wsURI);

                    websocket.onmessage = function(evt) { onMessage(evt); };
                    websocket.onopen = function(evt) { onOpen(evt); };
                    websocket.onclose = function(evt) { onClose(evt); };
                },
                error: function (request, status, error) {
                    console.log('Error occured: ' + error);
                }

            });
        };

        $('#next').click(function(){
            if (this.classList.contains("recording") && sentenceId <= 10) {
                // stop recording
                audioRecorder.stop();
                console.log('Your voice has been recorded.');
                this.classList.remove("recording");

                // disable 'Next' button until an message containing 'results' is received.
                var showId = sentenceId + 1;
                if(showId <= 10) {
                    $(this).text('Next ' + showId + '/10');
                    $(this).prop('disabled', true);
                } else {
                    // showId is 11 now. all the tests have been finished. Last sending action will be finished.
                    $(this).text('Get Report!');
                    $(this).prop('disabled', true);
                }

                audioRecorder.getBuffers( gotBuffers );

            } else if( !(this.classList.contains("recording")) && sentenceId <= 10){
                // start recording
                if (!audioRecorder)
                    return;
                console.log('Recording your voice......');

                // Send start signal
                websocket.send(JSON.stringify(startSig));

                // start recording
                this.classList.add("recording");
                audioRecorder.clear();
                audioRecorder.record();

                // Show the sentence that the user should be reading now.
                showSentence(sentenceId - 1);
                $(this).text('Submit!');

            } else {
                // This block happens when sentenceId == 11. We will show the report and finally we will disable it.
                $(this).prop('disabled', true);
                $('#reportShow').text(JSON.stringify(report, null, 4));
            }
        });

        $('#noiseDetection').click(function(){

        });

        $('#startTest').click(function(){
            $("#next").prop('disabled', false);
            $("#play").prop('disabled', false);
            $("#save").prop('disabled', false);

            getToken();
            loadSentence();
        });

        initialAudio();
    });
})(jQuery);
