#!/bin/env node

'use strict';

var express = require('express');
var fs      = require('fs');
var bodyParser = require('body-parser');
var qs = require('querystring');
var request = require('request');
var config = require('./ibmWatson.json');

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./public/index.html');
        self.zcache['freq.html'] = fs.readFileSync('./public/freq.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/freq'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('freq.html') );
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };

        self.routes['http://recordaudio-hongkun.apps.unc.edu'] = function(req, res) {
            res.redirect(301, 'https://recordaudio-hongkun.apps.unc.edu');
        }

        // local test
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();
        // self.app.use(express.static(__dirname));
        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
        ['css', 'img', 'js', 'decoration', 'plugin', 'lib'].forEach(function (dir){
            self.app.use('/'+ dir, express.static(__dirname+'/public/'+dir));
        });

        // TODO: Deploy API for IBM Watson Speech-to-text

        self.app.use(bodyParser.urlencoded({extended : true}));
        self.app.use(express.bodyParser());
        self.app.set('json spaces', 2);
        self.app.set('json replacer', null);

        // Test API
        self.app.use('/api', function(req, res){
            res.json({'message': 'Intelligibility API'});
        });

        self.app.get('/token', function(req, res){
            var token;

            var authTokenURL = 'https://stream.watsonplatform.net/authorization/api/v1/token';
            var url = 'https://stream.watsonplatform.net/speech-to-text/api/';

            var username = config['credentials']['username'];
            var password = config['credentials']['password'];

            authTokenURL = authTokenURL + '?' + 'url=' + url;

            var options = {
                'url': authTokenURL,
                'auth': {
                    'user': username,
                    'pass': password,
                    'sendImmediately': false
                }
            };

            request(options, function(err, resToken, body){
                if(!err && resToken.statusCode == 200){
                    res.json({'token': body});
                } else if( err ){
                    res.json({'Error occured': err});
                } else if( resToken.statusCode != 200 ){
                    res.json({'Error occured': resToken.statusCode});
                }
            });

        });

    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();
