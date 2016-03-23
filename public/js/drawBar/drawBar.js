
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
    var stream;

    // grab the mute button to use below

    var mute = document.querySelector('.mute');
    var pause = document.querySelector('.pause');
    var infoPara = document.querySelector('#info');
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

    // fps is frames per second
    var isNoiseDetection = false;
    var drawVisualStream = 1;
    var fps = 50;
    var HUMAN_VOICE_RATIO_THRESHOLD = 0.2;
    var HUMAN_VOICE_THRESHOLD = 0;
    var humanVoiceRatio = 0;
    var humanVoiceEnergy = 0;

    // queue to store the noise ratio
    var SAMPLE_CNT = 25;
    var ratioQueue = [];
    ratioQueue.pop = ratioQueue.shift;
    var energyQueue = [];
    energyQueue.pop = energyQueue.shift;

    var collectSample = function(data){
        document.getElementById("sampleDate").value += (data + '\n');
        console.log(data);
    }
    //==========================
    var soundSource, concertHallBuffer;

    //main block for doing the audio recording

    if (navigator.getUserMedia) {
       console.log('getUserMedia supported.');
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

          	 visualizeStream(analyserStream, canvas2);
          },

          // Error callback
          function(err) {
             console.log('The following gUM error occured: ' + err);
          }
       );
    } else {
        console.log('getUserMedia not supported on your browser!');
    }

    var visualizeStream = function(analyser, canvas) {

        var canvasCtx = canvas.getContext("2d");
        canvas.setAttribute('width',intendedWidth);

        WIDTH = canvas.width;
        HEIGHT = canvas.height;

        var visualSetting = visualSelect.value;
        console.log(visualSetting);

        analyser.fftSize = 1024;
        var bufferLength = analyser.frequencyBinCount;
        console.log(bufferLength);
        var dataArray = new Uint8Array(bufferLength);

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        var draw = function() {
            // drawVisualStream = requestAnimationFrame(draw, canvas);
            drawVisualStream += 1;

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

            // TODO: Add the feature of calculating the ratio of human voice.
            /* Every 10 frames we get samples from the frame.
               since fps = 50, we sample 5 frames per second.

               Solution 1: I will get the maximum of ratio average.
            */
            if(isNoiseDetection && drawVisualStream % 10 == 0){

                var totalEnergy = calcEnergy(analyser, 1, audioCtx.sampleRate / 2);
                var newHumanVoiceEnergy = calcEnergy(analyser, 80, 300);
                var newRatio = 0;

                if(totalEnergy > 0) {
                    newRatio = newHumanVoiceEnergy / totalEnergy;
                } else {
                    newRatio = 0;
                    if(newHumanVoiceEnergy > 0){
                        alert("Error: newHumanVoiceEnergy is not zero!");
                    }
                }

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
            }
        };

        setInterval(draw, 1000 / fps);
    };

    $("#noiseTestBtn").click(function(){
        if (this.classList.contains("testing")) {
            this.classList.remove("testing");
            $(this).text("Noise Test");
            isNoiseDetection = false;
            humanVoiceRatio = Math.max(humanVoiceRatio, average(ratioQueue));
            humanVoiceEnergy = Math.max(humanVoiceEnergy, average(energyQueue));
            if(humanVoiceRatio > HUMAN_VOICE_RATIO_THRESHOLD && humanVoiceEnergy > HUMAN_VOICE_THRESHOLD) {
                $("#successInfo").html("<br>" + "Yeah! You have just passed the test! Now you can go to formal voice test.");
            } else {
                $("#successInfo").html("<br>" + "Oops! You may speak louder and make sure the environment is quiet.");
            }
        } else {
            this.classList.add("testing");
            $(this).text("Testing...");
            isNoiseDetection = true;
            humanVoiceEnergy = 0;
            humanVoiceRatio = 0;
        }
    });

    // TODO: Given Float or Unit8 dataArray of frequency data, output the human voice energy.
    // ATTENTION: The unit of dataArray is dBFS.
    var calcEnergy = function(analyser, lowerBound, upperBound) {
        var dataFloatArray = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(dataFloatArray);
        var energy = 0;

        for(var i = 0; i < dataFloatArray.length; i ++) {
            var frequence = i * audioCtx.sampleRate / analyser.fftSize;
            if(lowerBound <= frequence && frequence <= upperBound)
            energy += Math.pow(10, dataFloatArray[i] / 10);
        }
        return energy;
    };

    var average = function(array) {
        var sum = array.reduce(function(a, b) {return a + b;});
        return sum / array.length;
    };
})(jQuery);
