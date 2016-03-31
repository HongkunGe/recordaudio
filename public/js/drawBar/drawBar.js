
(function($) {
    // fork getUserMedia for multiple browser versions, for those
    // that need prefixes

    navigator.getUserMedia = (navigator.getUserMedia ||
                              navigator.webkitGetUserMedia ||
                              navigator.mozGetUserMedia ||
                              navigator.msGetUserMedia);

    // set up forked web audio context, for multiple browsers
    // window. is needed otherwise Safari explodes

    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var source;
    var drawEnabled = false;
    // grab the mute button to use below

    var noiseTest = document.querySelector('#noiseTestBtn');

    var analyserStream = audioCtx.createAnalyser();
    analyserStream.minDecibels = -70;
    analyserStream.maxDecibels = -10;
    analyserStream.smoothingTimeConstant = 0.85;

    var gainNode = audioCtx.createGain();
    var biquadFilter = audioCtx.createBiquadFilter();
    var gainNodeStream = audioCtx.createGain();

    // set up canvas context for visualizer
    var canvas2 = document.querySelector('.visualizer#v2');
    var intendedWidth = document.querySelector('.wrapper').clientWidth;
    var visualSelect = document.getElementById("visual");

    // FPS is frames per second
    var isNoiseDetection = false;
    var drawVisualStream = 1;
    var FPS = 50;
    var FFT_SIZE = 1024;
    var HUMAN_VOICE_THRESHOLD = 0;
    var SAMPLE_CNT = 15; // 3 Seconds, 5 samples per second.
    var TOTAL_ENERGY_PER_FRAME = 0.0001;  // For each in sample(5 in total), Total energy interg rated over the whole spectrum.
    var HUMAN_VOICE_RATIO_THRESHOLD = 0.2; // TOTAL_ENERGY_PER_FRAME * 0.2 == HUMAN_VOICE_ENERGY

    // queue to store the noise ratio
    var ratioQueue = [];
    ratioQueue.pop = ratioQueue.shift;
    var energyQueue = [];
    energyQueue.pop = energyQueue.shift;

    var humanVoiceRatio = 0;
    var humanVoiceEnergy = 0;

    var shouldHandleKeyDown = true;
    // var collectSample = function(data){
    //     document.getElementById("sampleDate").value += (data + '\n');
    //     console.log(data);
    // }

    //main block for doing the audio recording
    var initialAudio = function() {
        if (navigator.getUserMedia) {
           console.log('GetUserMedia Supported!');
           navigator.getUserMedia (
              // constraints - only audio needed for this app
              {
                 audio: true
              },

              // Success callback
              function(stream) {
                 gainNodeStream.gain.value = 0;
                 source = audioCtx.createMediaStreamSource(stream);
                 source.connect(analyserStream);
                 analyserStream.connect(gainNodeStream);
                 gainNodeStream.connect(audioCtx.destination);

              	 noiseTestSampling(analyserStream, canvas2);
              },

              // Error callback
              function(err) {
                 console.log('The following gUM error occured: ' + err);
              }
           );
        } else {
            console.log('getUserMedia not supported on your browser!');
        }
    };
    var noiseTestSampling = function(analyser, canvas) {
        // Canvas draw settings.
        var canvasCtx = canvas.getContext("2d");
        canvas.setAttribute('width',intendedWidth);

        WIDTH = canvas.width;
        HEIGHT = canvas.height;

        analyser.fftSize = FFT_SIZE;
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
        var drawFrequencyBars = function() {
            // drawVisualStream = requestAnimationFrame(draw, canvas);
            // drawVisualStream += 1;

            analyser.getByteFrequencyData(dataArray);
            canvasCtx.fillStyle = 'rgb(0, 0, 0)';
            canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

            var barWidth = (WIDTH / bufferLength) * 3;
            var barHeight, frequency;
            var x = 0;

            for(var i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i];
                frequency = i * audioCtx.sampleRate / analyser.fftSize;
                var freqShow = parseInt(frequency);

                // Show the value of frequence at unit 50 and approximately 80Hz to 300Hz
                if(freqShow % 50 == 0 || i == 2 || i == 7){
                    canvasCtx.fillText(freqShow, x, HEIGHT);
                }

                // HEIGHT - barHeight / 2 - 12: -12 is because I need reserve some space for capitals. x-index.
                canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
                canvasCtx.fillRect(x, HEIGHT - barHeight / 2 - 12, barWidth, barHeight / 2);
                x += barWidth + 1;
            }
        };

        var getSample = function() {
            /* Every 10 frames we get samples from the frame.
               since FPS = 50, we sample 5 frames per second.
            */

            var dataFloatArray = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(dataFloatArray);
            var totalEnergy = calcEnergy(dataFloatArray, 1, audioCtx.sampleRate / 2);
            var newHumanVoiceEnergy = calcEnergy(dataFloatArray, 80, 300);
            var newRatio = 0;

            if(totalEnergy >= TOTAL_ENERGY_PER_FRAME) {
                newRatio = newHumanVoiceEnergy / totalEnergy;
                if(newRatio > 1){
                    alert("Error: newRatio is LARGER than 1!");
                }
            } else {
                /* If totalEnergy is lower than TOTAL_ENERGY_PER_FRAME, newRatio will be 0.
                  This way we can ensure that totalEnergy is large enough and ratio is high enough.
                */
                newRatio = 0;
                if(newHumanVoiceEnergy > TOTAL_ENERGY_PER_FRAME){
                    alert("Error: newHumanVoiceEnergy is LARGER than totalEnergy!");
                }
            }
            // console.log("newRatio: " + newRatio.toString());
            // console.log("totalEnergy: " + totalEnergy.toString());
            // console.log("newHumanVoiceEnergy: " + newHumanVoiceEnergy.toString());
            if(ratioQueue.length < SAMPLE_CNT) {
                ratioQueue.push(newRatio);
                energyQueue.push(newHumanVoiceEnergy);
            } else {
                // humanVoiceRatio = Math.max(humanVoiceRatio, average(ratioQueue));
                ratioQueue.pop();
                ratioQueue.push(newRatio);

                // humanVoiceEnergy = Math.max(humanVoiceEnergy, average(energyQueue));
                energyQueue.pop();
                energyQueue.push(newHumanVoiceEnergy);
            }
            // console.log("ratioQueue: " + ratioQueue.toString());
            // console.log("energyQueue: " + energyQueue.toString());
        };

        var actionsPerFrame = function() {
            drawVisualStream += 1;
            if(drawEnabled) {
                drawFrequencyBars();
            }
            if(isNoiseDetection && drawVisualStream % 10 == 0){
                getSample();
            }
        };

        setInterval(actionsPerFrame, 1000 / FPS);
    };

    $("#noiseTestBtn").click(function(){
        noiseTestFunc(this);
    });

    var noiseTestFunc = function(elem){
        if (elem.classList.contains("testing")) {
            elem.classList.remove("testing");
            $(elem).text("Noise Test");
            isNoiseDetection = false;
            humanVoiceRatio = Math.max(humanVoiceRatio, average(ratioQueue));
            humanVoiceEnergy = Math.max(humanVoiceEnergy, average(energyQueue));

            console.log("Noise test is Done! Human Voice Ratio is " + humanVoiceRatio);

            if(humanVoiceRatio > HUMAN_VOICE_RATIO_THRESHOLD && humanVoiceEnergy > HUMAN_VOICE_THRESHOLD) {
                // $("#successInfo").html("<br>" + "Yeah! You have just passed the test! Now you can go to formal voice test.");
                // $('#noiseTestScrollBtn').css('display','inline-block');
                // $("#startTest").prop('disabled', false);
            } else {
                // $("#successInfo").html("<br>" + "Oops! You may speak louder and make sure the environment is quiet.");
                $("#noiseAttention").css('display','block');
            }
            // console.log("maxTotal: " + maxTotal + " minTotal: " + minTotal);
        } else {
            elem.classList.add("testing");
            $(elem).text("Testing...");
            console.log("Noise test is running...");
            isNoiseDetection = true;
            humanVoiceEnergy = 0;
            humanVoiceRatio = 0;

            ratioQueue = [];
            ratioQueue.pop = ratioQueue.shift;
            energyQueue = [];
            energyQueue.pop = energyQueue.shift;
        }
    };
    // Given Float or Unit8 dataArray of frequency data, output the human voice energy.
    // ATTENTION: The unit of dataArray is dBFS.
    // var minTotal = 0, maxTotal = -150;
    var calcEnergy = function(dataFloatArray, lowerBound, upperBound) {
        var energy = 0;

        for(var i = 0; i < dataFloatArray.length; i ++) {
            var frequence = i * audioCtx.sampleRate / FFT_SIZE;
            if(lowerBound <= frequence && frequence <= upperBound) {
                energy += Math.pow(10, dataFloatArray[i] / 10);
            }
        }
        // var maxArray = Math.max(...dataFloatArray);
        // var minArray = Math.min(...dataFloatArray);
        // maxTotal = Math.max(maxTotal, maxArray);
        // minTotal = Math.min(minTotal, minArray);
        // console.log("maxArray: " + maxArray + "minArray: " + minArray); // + "dataFloatArray: " + dataFloatArray.toString()
        return energy;
    };

    var average = function(array) {
        var sum = array.reduce(function(a, b) {return a + b;});
        return sum / array.length;
    };

    initialAudio();
})(jQuery);
