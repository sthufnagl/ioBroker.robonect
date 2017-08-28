/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils   = require(__dirname + '/lib/utils'); // Get common adapter utils
var request = require('request');
var ping    = require("ping");


var ip      = '192.168.0.109';

var pin, data, getOptions;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.robonect.0
var adapter = utils.adapter('robonect');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    if (id === adapter.namespace + ".mower.start" && state.val) {
        startMower();
    }
    else if (id === adapter.namespace + ".mower.stop" && state.val) {
        stopMower();
    }
    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function startMower() {
    adapter.log.info("Start Gardena Sileno with the help of Robonect HX");
    doGET('data=[["settaggi", 11, 1]]');
    adapter.setState("mower.start", {val: false, ack: true});
}

function stopMower() {
    adapter.log.info("Stop Gardena Sileno with the help of Robonect HX");
    doGET('data=[["settaggi", 12, 1]]');
    adapter.setState("mower.stop", {val: false, ack: true});
}

function doGET(postData){
    var options = {
        url: "http://" + adapter.config.ip + ":80/json?cmd=status",
        async: true,
        method: 'GET',
        cache: false,
        headers: {'Accept': 'application/json'}
    }

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            data = JSON.parse(body);
            evaluateResponse(data);
        }
    });
}

function evaluateResponse(data){
  adapter.setState("lastsync", {val: new Date().toISOString(), ack: true});
  adapter.log.info(data);

}


function checkStatus() {
    ping.sys.probe(ip, function (isAlive) {
        adapter.setState("mower.connected", {val: isAlive, ack: true});
        if (isAlive) {
            request(getOptions, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    try{
                        data = JSON.parse(body);
                        evaluateResponse(data);
                    }catch(e){
                        adapter.log.warn(e);
                    }
                }
            });
        }
    });
}

function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info('config IP Adresse: ' + adapter.config.ip);

    getOptions = {
      url: "http://" + adapter.config.ip + ":80/json?cmd=status",
      type: "GET",
      headers: {'Accept': 'application/json'}
    };

    adapter.subscribeStates("mower.start");
    adapter.subscribeStates("mower.stop");

  var secs = 10;
  if (isNaN(secs) || secs < 1) {
      secs = 10;
  }

  setInterval(checkStatus, secs * 1000);


}
