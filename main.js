/* jshint -W097 */// jshint strict:false
/*jslint node: true */

"use strict";

// you have to require the utils module and call adapter function
var utils   = require(__dirname + '/lib/utils'); // Get common adapter utils
var request = require('request');
var ping    = require("ping");
var ip, pin, data, secs, getOptions;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.robonect.0

var adapter = utils.adapter('robonect');

function startMower() {
    adapter.log.info("Start Gardena Sileno with the help of Robonect HX");
    doGET('json?cmd=start');
    adapter.setState("mower.start", {val: false, ack: true});
}

function stopMower() {
    adapter.log.info("Stop Gardena Sileno with the help of Robonect HX");
    doGET('json?cmd=stop');
    adapter.setState("mower.stop", {val: false, ack: true});
}


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



function doGET(cmd){
    var options = {
        url:      "http://" + ip + ":80/"  + cmd,
        async:    true,
        method:   'GET',
        cache:    false,
        headers: {'Accept': 'application/json'}
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            data = JSON.parse(body);
            evaluateResponse(data);
        }
    });
}

function evaluateResponse(responseData){
  adapter.setState("lastsync", {val: new Date().toISOString(), ack: true});
  adapter.log.info(responseData);
  var v_status = responseData.status.status;
  if (v_status === 1) adapter.setState('mower.status', {val: 'parkt', ack: true});
  if (v_status === 2) adapter.setState('mower.status', {val: 'mäht', ack: true});
  if (v_status === 3) adapter.setState('mower.status', {val: 'sucht die Ladestation', ack: true});
  if (v_status === 4) adapter.setState('mower.status', {val: 'lädt', ack: true});
  if (v_status === 5) adapter.setState('mower.status', {val: 'wartet auf Umsetzen im manuellen Modus', ack: true});
  if (v_status === 7) adapter.setState('mower.status', {val: 'Fehlerstatus', ack: true});
  if (v_status === 8) adapter.setState('mower.status', {val: 'Schleifensignal verloren', ack: true});
  if (v_status === 16) adapter.setState('mower.status', {val: 'abgeschaltet', ack: true});
  if (v_status === 17) adapter.setState('mower.status', {val: 'schläft', ack: true});

  var v_stopped = responseData.status.stopped;
  if (v_stopped === false) adapter.setState('mower.status.auftrag2', {val: 'parkt', ack: true});
  if (v_stopped === true) adapter.setState('mower.status.auftrag2', {val: 'fährt', ack: true});

  adapter.setState('duration', responseData.status.duration);
  adapter.setState('mower.status.battery', {val: responseData.status.battery, ack: true});
  adapter.setState('mower.status.hours', {val: responseData.status.hours, ack: true});
  adapter.setState('mower.wlan.signal', {val: responseData.wlan.signal, ack: true});

  var v_mode = responseData.status.mode;
  if (v_mode === 0) adapter.setState('mower.mode', {val: 'Auto', ack: true});
  if (v_mode === 1) adapter.setState('mower.mode', {val: 'manuell', ack: true});
  if (v_mode === 2) adapter.setState('mower.mode', {val: 'Home', ack: true});
  if (v_mode === 3) adapter.setState('mower.mode', {val: 'Demo', ack: true});

  var v_timer_status = responseData.timer.status;
  if (v_timer_status === 0) adapter.setState('mower.status.timer', {val: 'Deaktiviert', ack: true});
  if (v_timer_status === 1) adapter.setState('mower.status.timer', {val: 'Aktiv', ack: true});
  if (v_timer_status === 2) adapter.setState('mower.status.timer', {val: 'Standby', ack: true});
}


function checkStatus() {
    ping.sys.probe(ip, function (isAlive) {
        adapter.setState("mower.connected", {val: isAlive, ack: true});
        if (isAlive) {
            request(getOptions, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    try{
                        var responseData = JSON.parse(body);
                        evaluateResponse(responseData);
                    }catch(e){
                        adapter.log.warn(e);
                    }
                }
            });
        }
    });
}

function main() {

  ip  = adapter.config.ip;
  pin = adapter.config.pin;
  secs = adapter.config.poll;


  adapter.log.info('config IP Adresse: ' + ip);
  adapter.log.info('config PIN: ' + pin);
  adapter.log.info('config Poll: ' + secs);

  getOptions = {
    headers:  {'Accept': 'application/json'},
    type:     "GET",
    url:      "http://" + ip + ":80/"+ 'json?cmd=status'
  };


  if (isNaN(secs) || secs < 1) {
    secs = 10;
  }

  adapter.subscribeStates("mower.start");
  adapter.subscribeStates("mower.stop");

  setInterval(checkStatus, secs * 1000);


}
