"use strict";

var Service, Characteristic, HomebridgeAPI;
var applescript = require('applescript');
const { HomebridgeShortcutsVersion } = require('./package.json');

module.exports = function(homebridge) {

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory("homebridge-shortcuts", "Siri Shorcuts", Shortcuts);
}


function Shortcuts(log, config) {
  this.log = log;
  this.name = config.name;
  this.onCommand = "tell application ''Shortcuts Events'' to set theResult to run shortcut " + "''" + config['on'] + "''";
  this.offCommand = "tell application ''Shortcuts Events'' to set theResult to run shortcut " + "''" + config['off'] + "''";
  this.stateful = config.stateful;
  this.time = config.time ? config.time : 1000;
  this.timer = null;
  this._service = new Service.Switch(this.name);
  
  this.informationService = new Service.AccessoryInformation();
  this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Homebridge')
      .setCharacteristic(Characteristic.Model, 'Shortcuts')
      .setCharacteristic(Characteristic.FirmwareRevision, HomebridgeShortcutsVersion)
      .setCharacteristic(Characteristic.SerialNumber, 'Shortcuts-' + this.name.replace(/\s/g, '-'));
  
  this.cacheDirectory = HomebridgeAPI.user.persistPath();
  this.storage = require('node-persist');
  this.storage.initSync({dir:this.cacheDirectory, forgiveParseErrors: true});
  
  this._service.getCharacteristic(Characteristic.On)
    .on('set', this._setOn.bind(this));


  if (this.stateful) {
	var cachedState = this.storage.getItemSync(this.name);
	if((cachedState === undefined) || (cachedState === false)) {
		this._service.setCharacteristic(Characteristic.On, false);
	} else {
		this._service.setCharacteristic(Characteristic.On, true);
	}
  }
}

Shortcuts.prototype.getServices = function() {
  return [this.informationService, this._service];
}

Shortcuts.prototype.setState = function(powerOn, callback) {
	var accessory = this;
	var state = powerOn ? 'on' : 'off';
	var prop = state + 'Command';
	var command = accessory[prop].replace(/''/g, '"');

	applescript.execString(command, done);

	function done(err, rtn) {
		if (err) {
			accessory.log('Error: ' + err);
			callback(err || new Error('Error setting ' + accessory.name + ' to ' + state));
		} else {
			accessory.log('Set ' + accessory.name + ' to ' + state);
			callback(null);
		}
	}
}

Shortcuts.prototype._setOn = function(on, callback) {

  this.log("Setting switch to " + on);

  if (on && !this.stateful) {
    this.timer = setTimeout(function() {
      this._service.setCharacteristic(Characteristic.On, false);
    }.bind(this), this.time);
  } else if (!on  && !this.stateful) {
    this.timer = setTimeout(function() {
      this._service.setCharacteristic(Characteristic.On, true);
    }.bind(this), this.time);
  }
  
  if (this.stateful) {
	this.storage.setItemSync(this.name, on);
  }
  
  callback();
}
