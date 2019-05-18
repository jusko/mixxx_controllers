var NumarkDJ2GO2 = new Object();

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

  NumarkDJ2GO2.setSuperGain = function(on) {
    if (on) {
      NumarkDJ2GO2.master = new NumarkDJ2GO2.SuperGainMaster();
      NumarkDJ2GO2.leftDeck = new NumarkDJ2GO2.SuperGainDeck(0);
      NumarkDJ2GO2.rightDeck = new NumarkDJ2GO2.SuperGainDeck(1);
    }
    else {
      NumarkDJ2GO2.master = new NumarkDJ2GO2.Master();
      NumarkDJ2GO2.leftDeck = new NumarkDJ2GO2.Deck(0);
      NumarkDJ2GO2.rightDeck = new NumarkDJ2GO2.Deck(1);
    }
  };
  NumarkDJ2GO2.setSuperGain(false);
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
 * Enter/exit "super gain" mode if load buttons pressed in shift mode
 */
NumarkDJ2GO2.enableSuperGain = function() {
  if (NumarkDJ2GO2.shiftMode) {
    NumarkDJ2GO2.setSuperGain(true);
  }
}

NumarkDJ2GO2.disableSuperGain = function() {
  if (NumarkDJ2GO2.shiftMode) {
    NumarkDJ2GO2.setSuperGain(false);
  }
}

/**
 * Regular master channel controls
 */
NumarkDJ2GO2.Master = function () {
  components.ComponentContainer.call(this)

  this.level = new components.Pot({
    midi: [0xBF, 0X0A],
    group: '[Master]',
    inKey: 'gain'
  });

  this.cueLevel = new components.Pot({
    midi: [0xBF, 0X0C],
    group: '[Master]',
    inKey: 'headGain'
  });
};
NumarkDJ2GO2.Master.prototype = Object.create(components.ComponentContainer.prototype)

/*
 * Master channel controls transforming master and cue level knobs to mid gain
 * equalizer knobs for both channels
 */
NumarkDJ2GO2.SuperGainMaster = function () {
  components.ComponentContainer.call(this)

  this.level = new NumarkDJ2GO2.EqGainKnob(0, {
    midi: [0xBF, 0X0A],
    inKey: 'parameter2'
  });

  this.cueLevel = new NumarkDJ2GO2.EqGainKnob(1, {
    midi: [0xBF, 0X0C],
    inKey: 'parameter2'
  });
};
NumarkDJ2GO2.SuperGainMaster.prototype = Object.create(components.ComponentContainer.prototype)

/**
 * A deck with the standard controller features
 */
NumarkDJ2GO2.Deck = function (channel) {
  components.Deck.call(this, [channel + 1]);

  this.playButton = new components.PlayButton([0x90 + channel, 0x00]);
  this.cueButton = new components.CueButton([0x90 + channel, 0x01]);
  this.syncButton = new components.SyncButton([0x90 + channel, 0x02]);

  this.jogWheel = new NumarkDJ2GO2.JogWheel(channel);

  this.gainLevel = new components.Pot({
    midi: [0xB0 + channel, 0X16],
    inKey: 'pregain'
  });

  this.reconnectComponents(function (component) {
    if (component.group === undefined) {
      component.group = this.currentDeck;
    }
  });
};
NumarkDJ2GO2.Deck.prototype = Object.create(components.Deck.prototype);

/**
 * A deck which transforms its jog wheel and gain level knob to low and hi gain
 * equalizer knobs respectively.
 */
NumarkDJ2GO2.SuperGainDeck = function (channel) {
  NumarkDJ2GO2.Deck.call(this, channel);

  this.jogWheel = new NumarkDJ2GO2.JogWheelGain(channel, 'parameter1');
  this.gainLevel = new NumarkDJ2GO2.EqGainKnob(channel, {
    midi: [0xB0 + channel, 0X16],
    inKey: 'parameter3'
  });
};
NumarkDJ2GO2.SuperGainDeck.prototype = Object.create(NumarkDJ2GO2.Deck.prototype);

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
  this.inKey = 'playposition';
  this.input = function(channel, control, value) {
    var tick = NumarkDJ2GO2.shiftMode ? 0.00025  : 0.01;
    if (value === 0x01) {
      this.inSetParameter(this.inGetParameter() + tick);
    }
    else if (value === 0x7F) {
      this.inSetParameter(this.inGetParameter() - tick);
    }
  };
}
NumarkDJ2GO2.JogWheel.prototype = Object.create(components.Encoder.prototype);

/**
 * Jog wheel mapped to a gain level
 */
NumarkDJ2GO2.JogWheelGain = function (channel, gain) {
  NumarkDJ2GO2.JogWheel.call(this, channel);

  this.group = '[EqualizerRack1_[Channel' + (channel + 1) + ']_Effect1]';
  this.inKey = gain;
  this.input = function(channel, control, value) {
    if (value === 0x01) {
      this.inSetParameter(this.inGetParameter() + 0.005);
    }
    else if (value === 0x7F) {
      this.inSetParameter(this.inGetParameter() - 0.005);
    }
  };
}
NumarkDJ2GO2.JogWheelGain.prototype = Object.create(NumarkDJ2GO2.JogWheel.prototype);

/**
 * Equalizer gain level knob
 */
NumarkDJ2GO2.EqGainKnob = function (channel, options) {
  components.Pot.call(this, options);

  this.group = '[EqualizerRack1_[Channel' + (channel + 1) + ']_Effect1]';
}
NumarkDJ2GO2.EqGainKnob.prototype = Object.create(components.Pot.prototype);
