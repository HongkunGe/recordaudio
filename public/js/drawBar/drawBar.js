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
var drawVisualStream, drawVisualSource;

//=============Power=============

var humanVoiceEnergy = 0;
var totalEnergy = 0;
var noiseLevel;

// write to some file. 
function collectSample(data){
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

function visualizeStream(analyser, canvas) {

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

    // var show1 = Number.MIN_VALUE, show2 = Number.MAX_VALUE;

    function draw() {
      drawVisualStream = requestAnimationFrame(draw, canvas);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgb(0, 0, 0)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      var barWidth = (WIDTH / bufferLength) * 3;
      var barHeight, frequency;
      var x = 0;

      humanVoiceEnergy = 0;
      totalEnergy = 0;

      for(var i = 0; i < bufferLength; i++) {
        // show1 = Math.max(show1, dataArray[i]);
        // show2 = Math.min(show2, dataArray[i]);
        barHeight = dataArray[i];

        frequency = i * audioCtx.sampleRate / analyser.fftSize;
        var freqShow = parseInt(frequency);
        if(freqShow % 50 == 0 || i == 2 || i == 7){
          canvasCtx.fillText(freqShow, x, HEIGHT);
        }
        if(barHeight > 50){
          if(freqShow >= 80 && freqShow <= 300){
            humanVoiceEnergy += barHeight * barHeight;
          }

          totalEnergy += barHeight * barHeight;
        }


        canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2 - 12, barWidth, barHeight / 2);
        
        x += barWidth + 1;
      }

      if(totalEnergy > 20000 && drawVisualStream % 10 == 0){
        collectSample(humanVoiceEnergy + ' ' + humanVoiceEnergy / totalEnergy);
      }
      
      // console.log(show2 + ' ' + show1);

    };

    draw();

}

// event listeners to change visualize and voice settings

visualSelect.onchange = function() {
  window.cancelAnimationFrame(drawVisualStream);
  pause.id = "";
  visualizeStream(analyserStream, canvas2);
  pause.innerHTML = "Pause";
}

mute.onclick = voiceMute;
canvas2.onclick = pauseBtn;
pause.onclick = pauseBtn;

function pauseBtn(){
  if(pause.id == ""){
    pause.id = "paused"
    window.cancelAnimationFrame(drawVisualStream);
    pause.innerHTML = "Start";
  } else {
    pause.id = "";
    visualizeStream(analyserStream, canvas2);
    pause.innerHTML = "Pause";
  }
}


function voiceMute() {
  if(mute.id == "") {
    gainNode.gain.value = 0;
    mute.id = "activated";
    mute.innerHTML = "Unmute";
  } else {
    gainNode.gain.value = 1;
    mute.id = "";    
    mute.innerHTML = "Mute";
  }
}

