var NumarkDJ2GO2 = {};

// -- Init --
NumarkDJ2GO2.init = function (id, debug) {
  components.Button.prototype.isPress = function (channel, control, value, status) {
    return (status & 0xF0) === 0x90;
  }

  NumarkDJ2GO2.leftDeck = new NumarkDJ2GO2.Deck(0);
  NumarkDJ2GO2.rightDeck = new NumarkDJ2GO2.Deck(1);
};

// -- Shutdown --
NumarkDJ2GO2.shutdown = function (id, debug) {
  midi.sendShortMsg(0x80, 0x1B, 0x01);
  midi.sendShortMsg(0x81, 0x1B, 0x01);

  midi.sendShortMsg(0x90, 0x00, 0x00);
  midi.sendShortMsg(0x91, 0x00, 0x00);
};

NumarkDJ2GO2.Deck = function (channel) {
  components.Deck.call(this, [channel + 1]);

  this.cueButton = new components.CueButton([0x90 + channel, 0x01]);
  this.syncButton = new components.SyncButton([0x90 + channel, 0x02]);

  this.reconnectComponents(function (component) {
    if (component.group === undefined) {
      component.group = this.currentDeck;
    }
  });
};
NumarkDJ2GO2.Deck.prototype = new components.Deck('prototype');

// -- Headphones --
NumarkDJ2GO2.headphonesOn = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 1);
}

NumarkDJ2GO2.headphonesOff = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x80 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 0);
}
