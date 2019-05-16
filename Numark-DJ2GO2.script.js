var NumarkDJ2GO2 = {};

NumarkDJ2GO2.init = function (id, debug) {
};

NumarkDJ2GO2.shutdown = function (id, debug) {
  midi.sendShortMsg(0x80, 0x1B, 0x01);
  midi.sendShortMsg(0x81, 0x1B, 0x01);
};

NumarkDJ2GO2.headphonesOn = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 1);
}

NumarkDJ2GO2.headphonesOff = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x80 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 0);
}
