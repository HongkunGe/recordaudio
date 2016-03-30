function consoleLog(text) {
  var scripts = document.getElementsByTagName( 'script' );
  var thisScriptTag = scripts[ scripts.length - 1 ];

  console.log(thisScriptTag + " " + text);
}
