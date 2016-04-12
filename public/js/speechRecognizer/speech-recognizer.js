(function($) {
        navigator.getUserMedia = (navigator.getUserMedia ||
                                  navigator.webkitGetUserMedia ||
                                  navigator.mozGetUserMedia ||
                                  navigator.msGetUserMedia);

        var audioContext = new (window.AudioContext || window.webkitAudioContext)();

        var voiceTestSection = document.querySelector('#VoiceTest');

        var source;
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
        var sentenceNumInGroup = 10;
        var sentenceGroupId = 1;
        var sentenceId = 1;
        var recordingSentenceId = 1;
        var sentenceDeferredMinusOne = 0;
        var blobQueue = [];
        blobQueue.pop_back = blobQueue.pop;  // blobQueue is a deque, pop from back.
        blobQueue.pop = blobQueue.shift;

        // tag certain sentence that has been transcripted or not.
        // TODO: Use operations to store the status of sentences.
        var hasBeenProcessed = [];

        var isProcessing = false;
        var startPos = 3;

        var getReports = false;

        var testIsFinished = false;
        var haveTried = 1;
        var totalScore = 0;
        var report = {
            'results':[],
            'events':[]
        };
        var statistics = {
            'average': 0,
            'median': 0,
            'max': 0,
            'min':0
        };
        var initialArray = function() {
            hasBeenProcessed.pop_back = hasBeenProcessed.pop;  // blobQueue is a deque, pop from back.
            hasBeenProcessed.pop = hasBeenProcessed.shift;
            for(var i = 0; i < sentenceNumInGroup; i++) {
                hasBeenProcessed.push(false);
            }

            for(var i = 0; i < sentenceNumInGroup; i++) {
                report['events'].push([]);
                report['results'].push(null);
            }
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
                showSentence(recordingSentenceId);
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
            var stRecogized;
            var stOriginal = selectedSentences[sentenceId - 1];
            var score;

            var recordItem = function() {
                var item = {
                    'sentenceId': sentenceId,
                    "recordingSentenceId": recordingSentenceId,
                    'originalSentence': stOriginal,
                    'recogizedSentence': stRecogized,
                    'score': score
                };
                // Assign new item to pre-allocated space.
                report['results'][sentenceId - 1] = item;
                report['events'][sentenceId - 1].push(
                    {
                        "item": item,
                        "event": "added"
                    }
                );
                totalScore += item['score'];
            };
            // All all the details to the report.
            if(evtResult.length == 0) {
                // $("#noiseAttention").css('display','block');
                stRecogized = "";
                score = 0;
            } else {
                stRecogized = evtResult[0]['alternatives'][0]['transcript'];
                score = sentenceScore(stRecogized, stOriginal);
            }
            recordItem();
            // When sentenceId == sentenceNumInGroup 10 as default, we won't enable 'Next' Button, but switch to ''GetReport' button and enable it.
            // sentenceId should be 11, when calculating the score.
            sentenceId++;
            sentenceId = sentenceId + sentenceDeferredMinusOne;
            sentenceDeferredMinusOne = 0;

            if(sentenceId == sentenceNumInGroup + 1) {
                generateStatistics();
            }
        };

        var generateStatistics = function() {
            var scores = [];
            var totalScore = 0;
            var median = 0;
            for(var i = 0; i < report['results'].length; i++) {
                scores.push(report['results'][i]['score']);
                totalScore += report['results'][i]['score'];
            }

            statistics['average'] = totalScore / scores.length;
            scores.sort();

            if(scores.length % 2){
                median = scores[parseInt(scores.length / 2)];
            } else {
                median = (scores[parseInt(scores.length / 2)] + scores[parseInt(scores.length / 2) - 1]) / 2;
            }
            statistics['median'] = median;
            statistics['max'] = scores[scores.length - 1];
            statistics['min'] = scores[0];
        };

        var deleteLastItemFromReport = function() {
            var info = JSON.stringify({
                "sentenceId": sentenceId,
                "recordingSentenceId": recordingSentenceId,
                "blobQueue.length": blobQueue.length
            });
            // if there is untranscripted blob in the blobQueue, pop_back
            // no such case recordingSentenceId > sentenceId && blobQueue.length == 0, since back button is clicked, recordingSentenceId-- =>
            if(recordingSentenceId > sentenceId && blobQueue.length > 0) {
                  console.log("pop_back blobQueue. " + info);
                  blobQueue.pop_back();

            } else if(recordingSentenceId == sentenceId && blobQueue.length > 0) {
                  // if I redo the same sentence several times, this block will be triggered.
                  console.log("Duplicate returns. " + info);
                  blobQueue.pop_back();

            // clicked back during transcripting. recordingSentenceId - sentenceId must be 0, sinse back is click, recordingSentenceId 3=>2, sentenceId is 2.
            } else if(recordingSentenceId == sentenceId && blobQueue.length == 0) {
                  // Try to delete the one that is being transcripted by IBM.
                  // The one to be sent back from IBM will be replaced by new one.
                  console.log("Mark Deferred. " + info);
                  var item = {
                      "recordingSentenceId": recordingSentenceId,
                      "sentenceId": sentenceId,
                      'recogizedSentence': "has not come out yet"
                  };
                  report['events'][sentenceId - 1].push(
                      {
                          "item": item,
                          "event": "deleted"
                      }
                  );
                  // for example, the 1st one: sentenceId 1=>0 here virtually, but once the transcription come back, onMessage is called, sentenceId++ => 1 again.
                  sentenceDeferredMinusOne = -1;

            } else if(recordingSentenceId < sentenceId) {

                console.log("Ready to replace old one. " + info);
                // recordingSentenceId - sentenceId must be -1
                // when all sentences recorded has been transcripted and stored.
                // replace the old one.
                sentenceId --; // => become recordingSentenceId
                report['events'][sentenceId - 1].push(
                    {
                        "item": report['results'][sentenceId - 1],
                        "event": "deleted"
                    }
                );

            } else {
                console.log("ERROR! message:" + info);
            }

        };

        var showReport = function() {
            // Show the report
            // $("#reportShow").css('display','inline-block');
            // $('#reportShow').text(JSON.stringify(statistics, null, 4) + '\n' + JSON.stringify(report, null, 4));
            $("#voiceTestScrollBtn").css('display','inline-block');
            $("#operationInfo").css('display','none');
            $("#sentenceShow").css('display','none');
            // $("#reportInfo").css('display','inline-block');

            // Generate the table
            var reportTableDiv = document.getElementById('reportShowTable');
            var table = document.createElement('table');
            var trh = document.createElement('tr');

            var tdh1 = document.createElement('td');
            var tdh2 = document.createElement('td');

            var items = document.createTextNode("Items");
            var scoreText = document.createTextNode("Score");

            tdh1.appendChild(items);
            tdh2.appendChild(scoreText);
            trh.appendChild(tdh1);
            trh.appendChild(tdh2);
            table.appendChild(trh);

            for(var key in statistics) {
                var tr = document.createElement('tr');

                var td1 = document.createElement('td');
                var td2 = document.createElement('td');

                var item = document.createTextNode(key);
                var value = document.createTextNode(statistics[key]);
                td1.appendChild(item);
                td2.appendChild(value);
                tr.appendChild(td1);
                tr.appendChild(td2);
                table.appendChild(tr);
            }
            reportTableDiv.appendChild(table);
            $("#reportShowTable").css('display','inline-table');
            $("#back").css('display','none');
            $("#next").css('display','none');
            $("#save").css('display','none');
        }

        var testAndShutDown = function() {
            // If test is finished
            if(getReports && sentenceId === sentenceNumInGroup + 1 && recordingSentenceId === sentenceNumInGroup + 1 && blobQueue.length === 0) {
                $("#next").prop('disabled', true);
                $("#back").prop('disabled', true);
                $("#layer2").css('display','none');
                showReport();

                testIsFinished = true;
                webSocket.close();
            }
        };

        var onMessage = function (evt) {
            console.log("onMessage: recognition result in json format: " + evt.data);

            // 'Next ?/10' button should be disabled before the results messages are received.
            var evtData = $.parseJSON(evt.data);
            if('results' in evtData){
                console.log('Response Received. sentenceId: ' + sentenceId);
                addItemToReport(evtData['results']);
                isProcessing = false;
                processBlobQueue(); //chained

                testAndShutDown();
            }

            //TODO: if('error' in evtData)
        };

        var onClose = function(evt) {
            console.log("Connection is Closed!");

            //TODO: If test is finished

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
                $("#layer2").css('display','none');
                $('#next').prop('disabled', true);
                $("#back").prop('disabled', true);
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
                $("#layer2").css('display','none');
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
                // Show the sentence that the user should be reading now.
                showSentence(recordingSentenceId);
                $("#back").prop('disabled', false);

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

                $("#next").text('Recording...');

            } else {
                // This block happens when sentenceId == 11. We will show the report and finally we will disable all buttons.

                $("#next").prop('disabled', true);
                $("#back").prop('disabled', true);
                $("#layer2").css('display','block');

                getReports = true;

                testAndShutDown();
            }
        };

        var backSwithFunc = function() {
            // back to last sentence
            if(recordingSentenceId - 1 > 0){
                recordingSentenceId = recordingSentenceId - 1;
                // var showId = sentenceId + 1;
                $('#next').text('Next '); // + showId + '/' + sentenceNumInGroup
                showSentence(recordingSentenceId);

                console.log("Back to last Sentence " + recordingSentenceId);
                deleteLastItemFromReport();
            } else {
                $("#back").prop('disabled', true);
            }
        };

        $('#next').click(function(){
            $("#noiseAttention").css('display','none');
            nextSwithFunc(this);
        });

        $('#back').click(function(){
            $("#noiseAttention").css('display','none');
            backSwithFunc(this);
        });

        $('#startTest').click(function(){
            $("#voiceTestSection").css('display','inline-block');
            $("#participationInfo").css('display','none');
            $("#next").prop('disabled', false);
            $("#play").prop('disabled', false);
            $("#save").prop('disabled', false);
            $('#startTest').prop('disabled', true);

            getToken();
            loadSentence();
        });

        initialArray();
        initialAudio();

})(jQuery);
