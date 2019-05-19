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

  /**
   * For whatever reason this refuses to work when the EqGainKnob (or even just
   * plain Pot components) connect for the first time in the Deck constructors
   * (but only in init(), not when swapping a deck for the first time). Remove
   * after implementing serato_sysex
  */
  engine.softTakeover('[Master]', 'gain', true);
  engine.softTakeover('[Master]', 'headGain', true);
  engine.softTakeover('[Channel1]', 'pregain', true);
  engine.softTakeover('[Channel2]', 'pregain', true);

  NumarkDJ2GO2.shiftMode = false;
  NumarkDJ2GO2.decks = [
    new NumarkDJ2GO2.MultiDeck(0),
    new NumarkDJ2GO2.MultiDeck(1)
  ];
  NumarkDJ2GO2.setDecks();
};

NumarkDJ2GO2.setDecks = function() {
  NumarkDJ2GO2.leftDeck = NumarkDJ2GO2.decks[0].getDeck();
  NumarkDJ2GO2.rightDeck = NumarkDJ2GO2.decks[1].getDeck();
}

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
 * Core deck controls
 */
NumarkDJ2GO2.DeckBase = function (channel) {
  components.Deck.call(this, [channel + 1]);

  this.playButton = new components.PlayButton([0x90 + channel, 0x00]);
  this.cueButton = new components.CueButton([0x90 + channel, 0x01]);
  this.syncButton = new components.SyncButton([0x90 + channel, 0x02]);
  this.loadButton = new NumarkDJ2GO2.LoadButton([0x9F, 0x02 - channel]);

  this.reconnectComponents(function (component) {
    if (component.group === undefined) {
      component.group = this.currentDeck;
    }
  });
};
NumarkDJ2GO2.DeckBase.prototype = Object.create(components.Deck.prototype);

/**
 * Standard deck
 */
NumarkDJ2GO2.StandardDeck = function (channel) {
  this.jogWheel = new NumarkDJ2GO2.JogWheel(channel);

  this.knob1 = new components.Pot({
    midi: [0xBF, (channel === 0 ? 0x0A : 0x0C)],
    inKey: channel == 0 ? 'gain' : 'headGain',
    group: '[Master]'
  });

  this.knob2 = new components.Pot({
    midi: [0xB0 + channel, 0x16],
    inKey: 'pregain'
  });
  NumarkDJ2GO2.DeckBase.call(this, channel);
};
NumarkDJ2GO2.StandardDeck.prototype = Object.create(NumarkDJ2GO2.DeckBase.prototype);

/**
 * Equalizer deck
 */
NumarkDJ2GO2.EqualizerDeck = function (channel) {
  this.jogWheel = new NumarkDJ2GO2.JogWheelGain(channel, 'parameter1');

  this.knob1 = new NumarkDJ2GO2.EqGainKnob(channel, {
    midi: [0xBF, (channel === 0 ? 0x0A : 0x0C)],
    inKey: 'parameter2'
  });

  this.knob2 = new NumarkDJ2GO2.EqGainKnob(channel, {
    midi: [0xB0 + channel, 0x16],
    inKey: 'parameter3'
  });
  NumarkDJ2GO2.DeckBase.call(this, channel);
};
NumarkDJ2GO2.EqualizerDeck.prototype = Object.create(NumarkDJ2GO2.DeckBase.prototype);

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
 * Standard jog wheel
 */
NumarkDJ2GO2.JogWheel = function (channel) {
  components.Encoder.call(this);
  this.midi = [0xB0 + channel, 0x06];
  this.group = '[Channel' + (channel + 1) + ']';
}
NumarkDJ2GO2.JogWheel.prototype = new components.Encoder({
  inKey: 'playposition',
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
  components.Encoder.call(this);

  this.midi = [0xB0 + channel, 0x06];
  this.group = '[EqualizerRack1_[Channel' + (channel + 1) + ']_Effect1]';
  this.inKey = gain;
}
NumarkDJ2GO2.JogWheelGain.prototype = new components.Encoder({
  input: function(channel, control, value) {
    if (value === 0x01) {
      this.inSetParameter(this.inGetParameter() + 0.005);
    }
    else if (value === 0x7F) {
      this.inSetParameter(this.inGetParameter() - 0.005);
    }
  }
});

/**
 * Equalizer gain level knob
 */
NumarkDJ2GO2.EqGainKnob = function (channel, options) {
  components.Pot.call(this, options);

  this.group = '[EqualizerRack1_[Channel' + (channel + 1) + ']_Effect1]';
}
/**
 * These are override because there's some funky code going on in Pot's default
 * connect methods (go look, it checks a variable, this.relative, which doesn't 
 * even exist anywhere). This works.
 */
NumarkDJ2GO2.EqGainKnob.prototype = new components.Pot({
  connect: function() {
    engine.softTakeover(this.group, this.inKey, true);
  },
  disconnect: function() {
    engine.softTakeoverIgnoreNextValue(this.group, this.inKey);
  }
});

/**
 * Load button
 */
NumarkDJ2GO2.LoadButton = function(channel, midi) {
  components.Button.call(this);
  this.channel = channel;
  this.midi = midi;
  this.group = '[Channel16]';
}
NumarkDJ2GO2.LoadButton.prototype = new components.Button({
  input: function(channel, control) {
    if (NumarkDJ2GO2.shiftMode) {
      NumarkDJ2GO2.decks[control - 0x02].toggle();
      NumarkDJ2GO2.setDecks();
    }
  }
});

/**
 * Simple deck container to track toggling between single instances of
 * StandardDeck and EqualizerDeck
 */
NumarkDJ2GO2.MultiDeck = function(channel) {
  this.currentDeck = 0;
  this.decks = [
    new NumarkDJ2GO2.StandardDeck(channel),
    new NumarkDJ2GO2.EqualizerDeck(channel)
  ];
};
NumarkDJ2GO2.MultiDeck.prototype = new Object({
  toggle: function() {
    this.decks[this.currentDeck].forEachComponent(function(component) {
      component.disconnect();
    });
    this.currentDeck = this.currentDeck === 0 ? 1 : 0;
    this.decks[this.currentDeck].reconnectComponents();
  },
  getDeck: function() {
    return this.decks[this.currentDeck];
  }
});
