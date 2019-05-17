var NumarkDJ2GO2 = new Object;

/**
 * Init
 */
NumarkDJ2GO2.init = function (id, debug) {
  /** 
   * The controller sends press signals with 0x9 and release signals with 0x8
   * opcodes. Therefore the isPress function must be overridden as explained
   * at the end of https://www.mixxx.org/wiki/doku.php/components_js#button
   */
  components.Button.prototype.isPress = function (channel, control, value, status) {
    return (status & 0xF0) === 0x90;
  }

  NumarkDJ2GO2.shiftMode = false;
  NumarkDJ2GO2.leftDeck = new NumarkDJ2GO2.Deck(0);
  NumarkDJ2GO2.rightDeck = new NumarkDJ2GO2.Deck(1);
};

/**
 * Shutdown
 */
NumarkDJ2GO2.shutdown = function (id, debug) {
  midi.sendShortMsg(0x80, 0x1B, 0x01);
  midi.sendShortMsg(0x81, 0x1B, 0x01);

  for (var i = 0x00; i <= 0x02; ++i) {
    midi.sendShortMsg(0x90, i, 0x00);
    midi.sendShortMsg(0x91, i, 0x00);
  }
};

/*
 * Enable shift mode while the browse button is held down
 */
NumarkDJ2GO2.shiftModeOn = function () {
  NumarkDJ2GO2.shiftMode = true;
};

NumarkDJ2GO2.shiftModeOff = function () {
  NumarkDJ2GO2.shiftMode = false;
};

/**
 * NumarkDJ2GO.Deck
 */
NumarkDJ2GO2.Deck = function (channel) {
  components.Deck.call(this, [channel + 1]);

  this.playButton = new components.PlayButton([0x90 + channel, 0x00]);
  this.cueButton = new components.CueButton([0x90 + channel, 0x01]);
  this.syncButton = new components.SyncButton([0x90 + channel, 0x02]);

  this.jogWheel = new NumarkDJ2GO2.JogWheel(channel);

  this.reconnectComponents(function (component) {
    if (component.group === undefined) {
      component.group = this.currentDeck;
    }
  });
};
NumarkDJ2GO2.Deck.prototype = new components.Deck('prototype');

/**
 * Headphones/PFL Events 
 *
 * The controller toggles between signals internally, so it's simpler just
 * to handle them individually without components.
 */
NumarkDJ2GO2.headphonesOn = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x90 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 1);
};

NumarkDJ2GO2.headphonesOff = function(channel, control, value, status, group) {
  midi.sendShortMsg(0x80 + channel, 0x1B, 0x01);
  engine.setValue(group, 'pfl', 0);
};

/**
 * Custom Components
 */


/**
 * Standard jog wheel
 */
NumarkDJ2GO2.JogWheel = function (channel) {
  components.Encoder.call(this);
  this.midi = [0xB0 + channel, 0x06];
  this.group = '[Channel' + (channel + 1) + ']';
}
NumarkDJ2GO2.JogWheel.prototype = new components.Encoder({
  key: 'playposition',
  input: function(channel, control, value) {
    var tick = NumarkDJ2GO2.shiftMode ? 0.00025  : 0.01;
    if (value === 0x01) {
      this.inSetParameter(this.inGetParameter() + tick);
    }
    else if (value === 0x7F) {
      this.inSetParameter(this.inGetParameter() - tick);
    }
  }
});

/**
 * Jog wheel mapped to a gain level
 */
NumarkDJ2GO2.JogWheelGain = function (channel, gain) {
  components.Pot.call(this);

  this.midi = [0xB0 + channel, 0x06];
  this.group = '[EqualizerRack1_[Channel' + (channel + 1) + ']_Effect1]';
  this.inKey = gain;
}
NumarkDJ2GO2.JogWheelGain.prototype = new components.Pot({
  input: function(channel, control, value) {
    if (value === 0x01) {
      this.inSetParameter(this.inGetParameter() + 0.005);
    }
    else if (value === 0x7F) {
      this.inSetParameter(this.inGetParameter() - 0.005);
    }
  }
});
