var NumarkDJ2GO2 = {};

// -- Init --
NumarkDJ2GO2.init = function (id, debug) {
};

// -- Shutdown --
NumarkDJ2GO2.shutdown = function (id, debug) {
  midi.sendShortMsg(0x80, 0x1B, 0x01);
  midi.sendShortMsg(0x81, 0x1B, 0x01);
};

NumarkDJ2GO2.Deck = function (channel) {
};

// -- Headphones --
NumarkDJ2GO2.headphonesOn = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 1);
}

NumarkDJ2GO2.headphonesOff = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x80 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 0);
}

// -- Sync --
NumarkDJ2GO2.syncPressed = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x02, 0x02);
  engine.setValue(group, 'sync_enabled', 1);
}

NumarkDJ2GO2.syncReleased = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x02, 0x00);
  engine.setValue(group, 'sync_enabled', 0);
}

// -- Cue --
NumarkDJ2GO2.cuePressed = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x01, 0x02);
  engine.setValue(group, 'cue_default', 1);
}

NumarkDJ2GO2.cueReleased = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x01, 0x00);
  engine.setValue(group, 'cue_default', 0);
}
