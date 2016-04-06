(function($) {
        navigator.getUserMedia = (navigator.getUserMedia ||
                                  navigator.webkitGetUserMedia ||
                                  navigator.mozGetUserMedia ||
                                  navigator.msGetUserMedia);

        var audioContext = new (window.AudioContext || window.webkitAudioContext)();

        var voiceTestSection = document.querySelector('#VoiceTest');

        var source;
        var stream;
        var analyzer = audioContext.createAnalyser();
        var gainNode = audioContext.createGain();
        var audioRecorder = null;
        var recIndex = 0;

        var token = null;
        var wsURI = "wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token=";
        var webSocket = null;

        var startSig = {"action": "start", "content-type": "audio/wav;rate=22050", "inactivity_timeout": 100};
        var stopSig = {"action": "stop"};

        var selectedSentences;             // selected sentence group.
        var sentenceNumInGroup = 3;
        var sentenceGroupId = 1;
        var sentenceId = 1;
        var recordingSentenceId = 1;
        var blobQueue = [];
        blobQueue.pop = blobQueue.shift;
        var isProcessing = false;
        var startPos = 3;

        var testIsFinished = false;
        var haveTried = 1;
        var totalScore = 0;
        var report = {
            'emptyResultsReturned': 0,
            'sentenceCount': 0,
            'average': 0,
            'results':[],
            'deleted':[]
        };
        var operations = [];
        var logs = [];

        var getStream = function(stream){
            gainNode.gain.value = 0;

            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyzer);
            analyzer.connect(gainNode);
            gainNode.connect(audioContext.destination);

            audioRecorder = new Recorder(source);
        };

        var doneEncoding = function ( blob ) {

            blobQueue.push(blob);

            console.log("isProcessing: " + isProcessing);
            if(blobQueue.length == 1 && !isProcessing) {
                processBlobQueue();
            }
            Recorder.setupDownload( blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav" );
            recIndex++;
        };

        var processBlobQueue = function() {
            if(blobQueue.length > 0) {
                console.log('Making request to Watson...... sentenceId: ' + sentenceId);

                isProcessing = true;
                // Send start signal
                webSocket.send(JSON.stringify(startSig));

                blob = blobQueue.pop();
                webSocket.send(blob);

                setTimeout(function(){
                    webSocket.send(JSON.stringify(stopSig));
                }, 1500);

                console.log('Audio sent. sentenceId: ' + sentenceId);
            } else {
                console.log('blobQueue is empty now.');
            }
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
            $("#sentenceShow").css('display','inline-block');
            $('#sentenceShow').html(selectedSentences[id - 1]);
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

        var addItemToReport = function(evtResult) {
            // All all the details to the report.
            if(evtResult.length == 0) {

                // Push 0 to operations: We got an empty result from IBM Watson.
                operations.push(0);
                // Sometimes results is empty. Eliminate this one.
                report['emptyResultsReturned'] ++;
                $("#noiseAttention").css('display','block');
            } else {
                // // Push 0 to operations: We got a normal result from IBM Watson.
                operations.push(1);
                report['sentenceCount'] ++;
                var stRecogized = evtResult[0]['alternatives'][0]['transcript'];
                var stOriginal = selectedSentences[sentenceId - 1];

                var item = {
                    'originalSentence': stOriginal,
                    'recogizedSentence': stRecogized,
                    'score': sentenceScore(stRecogized, stOriginal)
                };
                report['results'].push(item);
                totalScore += item['score'];
            }

            // When sentenceId == sentenceNumInGroup 10 as default, we won't enable 'Next' Button, but switch to ''GetReport' button and enable it.
            // sentenceId should be 11, when calculating the score.
            sentenceId++;
            if(sentenceId == sentenceNumInGroup + 1) {
                report['average'] = Math.round(totalScore / report['sentenceCount']);
            }
        };

        var deleteLastItemFromReport = function() {
            // TODO: deleteLastItemFromReport or eliminate a 0. TEST

            if(operations.length != 0) {
                var lastOperation = operations.pop();
                if(lastOperation == 1) {
                    report['sentenceCount'] --;
                    var lastItem = report['results'].pop();
                    totalScore -= lastItem['score'];
                    report['deleted'].push(lastItem);
                } else {
                    // Last Operation only give us an empty result, do nothing but below.
                    report['emptyResultsReturned'] --;
                    if(report['emptyResultsReturned'] < 0) {
                        alert("Operations: emptyResultsReturned is less than 0!");
                    }
                }

            } else {
                alert("Operations: We have deleted all sentences!");
            }
        };

        var showReport = function() {
            // Show the report
            $("#reportShow").css('display','inline-block');
            $('#reportShow').text(JSON.stringify(report, null, 4));
        }

        var onMessage = function (evt) {
            console.log("onMessage: recognition result in json format: " + evt.data);

            // 'Next ?/10' button should be disabled before the results messages are received.
            var evtData = $.parseJSON(evt.data);
            if('results' in evtData){
                console.log('Response Received. sentenceId: ' + sentenceId);
                addItemToReport(evtData['results']);
                isProcessing = false;
                processBlobQueue();

                // If test is finished
                if(sentenceId === sentenceNumInGroup + 1 && recordingSentenceId === sentenceNumInGroup + 1 && blobQueue.length === 0) {
                    $("#next").prop('disabled', true);
                    $("#back").prop('disabled', true);
                    $("#layer2").css('display','none');
                    showReport();
                    testIsFinished = true;
                    webSocket.close();
                }
            }

            //TODO: if('error' in evtData)
        };

        var onClose = function(evt) {
            console.log("Connection is Closed!");

            if(!testIsFinished && haveTried < 6) {
                console.log("onClose: Reconnecting " + haveTried);
                haveTried ++;
                webSocketConnect();

                // re-enable the next and back buttons.
                $('#next').prop('disabled', false);
                $("#back").prop('disabled', false);
            } else if(testIsFinished){
                console.log("onClose: Test is finished");
            } else {
                $("#sessionExpiredInfo").css('display','block');
                console.log("onClose: Something bad happens, since I have tried " + 6 + " times but all failed.");
            }
        };

        var onOpen = function(evt) {
            console.log("onOpen: Connection is Open!");
        };

        var onError = function(evt) {
            var evtData = $.parseJSON(evt.data);

            console.log("onError: " + evtData);

            var message = evtData['error'];
            var sessionTimeOut = "Session timed out";
            if(message.indexOf(sessionTimeOut) == -1) {
                $("#errorInfo").css('display','block');
            }
        };

        var getToken = function(){
            $.ajax({
                type: 'GET',
                url: '/token',
                success: function (data, text) {
                    console.log(data);
                    token = data['token'];
                    wsURI = wsURI + token;
                    webSocketConnect();
                },
                error: function (request, status, error) {
                    console.log('Get Token from IBM Watson failed. Please refresh the browser.')
                    console.log('Error occured: ' + error);
                }

            });
        };

        var webSocketConnect = function() {
            webSocket = new WebSocket(wsURI);

            webSocket.onmessage = function(evt) { onMessage(evt); };
            webSocket.onopen = function(evt) { onOpen(evt); };
            webSocket.onclose = function(evt) { onClose(evt); };
            webSocket.onerror = function(evt) { onError(evt) };
        };

        var nextSwithFunc = function(elem){
            if (elem.classList.contains("recording") && recordingSentenceId <= sentenceNumInGroup) {
                // stop recording
                audioRecorder.stop();
                console.log('======Your voice has been recorded.');
                elem.classList.remove("recording");
                /* Disable 'Next' &'Back' button until an message containing 'results' is received.
                   Show the Spinner
                */
                recordingSentenceId++;
                if(recordingSentenceId <= sentenceNumInGroup) {
                    $("#next").text('Next '); // + showId + '/' + sentenceNumInGroup
                } else {
                    // showId is 11 now. all the tests have been finished. Last sending action will be finished.
                    $("#next").text('Get Report!');
                }
                audioRecorder.getBuffers( gotBuffers );

            } else if( !(elem.classList.contains("recording")) && recordingSentenceId <= sentenceNumInGroup){
                // start recording
                if (!audioRecorder)
                    return;
                console.log("======recordingSentenceId: " + recordingSentenceId);
                console.log('======Recording your voice......');

                // start recording
                elem.classList.add("recording");
                audioRecorder.clear();
                audioRecorder.record();

                // Show the sentence that the user should be reading now.
                showSentence(recordingSentenceId);
                $("#next").text('Recording...');

            } else {
                // This block happens when sentenceId == 11. We will show the report and finally we will disable all buttons.

                $("#next").prop('disabled', true);
                $("#back").prop('disabled', true);
                $("#layer2").css('display','block');

                console.log(logs);
            }
        };

        var backSwithFunc = function() {
            // back to last sentence
            if(sentenceId - 1 > 0){
                sentenceId = sentenceId - 1;
                // var showId = sentenceId + 1;
                $('#next').text('Next '); // + showId + '/' + sentenceNumInGroup
                showSentence(sentenceId);

                console.log("Back to last Sentence " + sentenceId);
                deleteLastItemFromReport();
            } else {
                $("#back").prop('disabled', true);
            }
        };

        $('#next').click(function(){
            $("#noiseAttention").css('display','none');
            logs.push('addNewItem');
            nextSwithFunc(this);
        });

        $('#back').click(function(){
            $("#noiseAttention").css('display','none');
            logs.push('deleteAnItem');
            backSwithFunc(this);
        });

        $('#startTest').click(function(){
            $("#voiceTestSection").css('display','inline-block');
            $("#next").prop('disabled', false);
            $("#play").prop('disabled', false);
            $("#save").prop('disabled', false);
            $('#startTest').prop('disabled', true);

            getToken();
            loadSentence();
        });

        initialAudio();

})(jQuery);
