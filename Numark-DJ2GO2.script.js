var NumarkDJ2GO2 = new Object({
  shiftMode: false,
  channels: [
    '[Channel1]',
    '[Channel2]'
  ]
});

/**
 * Override Pot's connect and disconnect methods to work more smoothly with
 * the way MultiDeck hot swaps components when toggling decks
 */
components.Pot.prototype.connect = function() {
  engine.softTakeover(this.group, this.inKey, true);
}
components.Pot.prototype.disconnect = function() {
  engine.softTakeoverIgnoreNextValue(this.group, this.inKey);
}

/**
 * Init
 */
NumarkDJ2GO2.init = function (id, debug) {
  NumarkDJ2GO2.decks = [
    new NumarkDJ2GO2.MultiDeck(0),
    new NumarkDJ2GO2.MultiDeck(1)
  ];
  NumarkDJ2GO2.setDecks();
  NumarkDJ2GO2.browser = new NumarkDJ2GO2.Browser();
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
  for (var i = 0x01; i <= 0x04; ++i) {
    for (var j = 0x00; j <= 0x30; j += 0x10) {
      midi.sendShortMsg(0x94, j + i, 0x00);
      midi.sendShortMsg(0x95, j + i, 0x00);
    }
  }
};

/**
 * Core deck controls
 */
NumarkDJ2GO2.DeckBase = function (channel) {
  components.Deck.call(this, [channel + 1]);

  this.playButton = new components.PlayButton([0x90 + channel, 0x00]);
  this.cueButton = new components.CueButton([0x90 + channel, 0x01]);
  this.syncButton = new components.SyncButton([0x90 + channel, 0x02]);
  this.hotcues = new NumarkDJ2GO2.HotcueButtonPad(channel);
  this.autoloops = new NumarkDJ2GO2.AutoLoopButtonPad(channel);
  this.loops = new NumarkDJ2GO2.ManualLoopButtonPad(channel);

  this.fader = new NumarkDJ2GO2.Fader(channel);

  this.reconnectComponents(function (component) {
    if (component.group === undefined) {
      component.group = NumarkDJ2GO2.channels[channel];
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
    inKey: 'pregain',
    group: NumarkDJ2GO2.channels[channel]
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
}
NumarkDJ2GO2.JogWheel.prototype = new components.Encoder({
  inKey: 'playposition',
  input: function(channel, control, value) {
    // TODO: Implement shift & unshift functions & remove the global variable
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
NumarkDJ2GO2.EqGainKnob.prototype = Object.create(components.Pot.prototype);

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

/**
 * Fader
 */
NumarkDJ2GO2.Fader = function(channel) {
  components.Pot.call(this);
  this.midi = [0xB0 + channel, 0x09];
  this.invert = true;
  this.group = NumarkDJ2GO2.channels[channel];
}
NumarkDJ2GO2.Fader.prototype = new components.Pot({
  shift: function() {
    this.disconnect();
    this.inKey = 'volume';
    this.connect();
  },
  unshift: function() {
    this.disconnect();
    this.inKey = 'rate';
    this.connect();
  }
});

/**
 * Base button pad class
 */
NumarkDJ2GO2.ButtonPad = function(channel, createButtonFn) {
  components.ComponentContainer.call(this);

  this.buttons = [];

  for (var i = 1; i <= 4; i++) {
    this.buttons[i - 1] = createButtonFn(channel, i);
  }
};
NumarkDJ2GO2.ButtonPad.prototype = Object.create(components.ComponentContainer.prototype);

/**
 * Hot cue buttons
 */
NumarkDJ2GO2.HotcueButtonPad = function(channel) {
  NumarkDJ2GO2.ButtonPad.call(this, channel, function(channel, number) {
    return new components.HotcueButton({
      midi: [0x94 + channel, 0x00 + number],
      number: number,
      group: NumarkDJ2GO2.channels[channel]
    });
  });
}
NumarkDJ2GO2.HotcueButtonPad.prototype = Object.create(NumarkDJ2GO2.ButtonPad.prototype);

/**
 * Auto loop buttons
 */
NumarkDJ2GO2.AutoLoopButtonPad = function(channel) {
  NumarkDJ2GO2.ButtonPad.call(this, channel, function(channel, number) {
    var beats = (number === 3) ? 4 : ((number === 4) ? 8 : number)

    return new components.Button({
      midi: [0x94 + channel, 0x10 + number],
      group: NumarkDJ2GO2.channels[channel],
      inKey: 'beatloop_' + beats + '_toggle',
      outKey: 'beatloop_' + beats + '_enabled'
    });
  });
};
NumarkDJ2GO2.AutoLoopButtonPad.prototype = Object.create(NumarkDJ2GO2.ButtonPad.prototype);

/**
 * Manual loop buttons
 */
NumarkDJ2GO2.ManualLoopButtonPad = function(channel) {
  components.ComponentContainer.call(this);

  this.button1 = new components.Button({
    midi: [0x94 + channel, 0x21],
    group: NumarkDJ2GO2.channels[channel],
    inKey: 'loop_in',
    outKey: 'loop_enabled'
  });
  this.button2 = new components.Button({
    midi: [0x94 + channel, 0x22],
    group: NumarkDJ2GO2.channels[channel],
    inKey: 'loop_out',
    outKey: 'loop_enabled'
  });
  this.button3 = new components.Button({
    midi: [0x94 + channel, 0x23],
    group: NumarkDJ2GO2.channels[channel],
    inKey: 'reloop_toggle',
    on: 0x00
  });
  this.button4 = new components.Button({
    midi: [0x94 + channel, 0x24],
    group: NumarkDJ2GO2.channels[channel],
    inKey: 'loop_in_goto',
    on: 0x00
  });
};
NumarkDJ2GO2.AutoLoopButtonPad.prototype = Object.create(components.ComponentContainer.prototype);

/**
 * Browser
 */
NumarkDJ2GO2.Browser = function() {
  components.ComponentContainer.call(this);

  this.browseKnob = new components.Encoder({
    midi: [0xBF, 0x00],
    group: '[Library]',
    key: 'MoveVertical',
    shift: function() {
      this.inKey = 'MoveFocus';
    },
    unshift: function() {
      this.inKey = 'MoveVertical';
    },
    input: function(channel, control, value) {
      if (value === 0x01) {
        this.inSetParameter(1);
      }
      else if (value === 0x7F) {
        this.inSetParameter(-1);
      }
    }
  });
  this.loadButton1 = new NumarkDJ2GO2.LoadButton(0);
  this.loadButton2 = new NumarkDJ2GO2.LoadButton(1);
  this.shiftButton = new NumarkDJ2GO2.ShiftButton();
}
NumarkDJ2GO2.Browser.prototype = Object.create(components.ComponentContainer.prototype);

/**
 * Load buttons for for browsing and loading tracks
 */
NumarkDJ2GO2.LoadButton = function(channel) {
  components.Button.call(this);
  this.channel = channel;
  this.midi = [0x9F, 0x02 + channel];
}
NumarkDJ2GO2.LoadButton.prototype = new components.Button({
  shift: function() {
    NumarkDJ2GO2.decks[0 + this.channel].toggle();
    NumarkDJ2GO2.setDecks();
  },
  unshift: function() {
    this.group = NumarkDJ2GO2.channels[this.channel];
    this.inKey = 'LoadSelectedTrack';
  }
});

NumarkDJ2GO2.ShiftButton = function() {
  components.Button.call(this);

  this.midi = [0x9F, 0x06];
};
NumarkDJ2GO2.ShiftButton.prototype = new components.Button({
  input: function(channel, control, value, status) {
    if (this.isPress(channel, control, value, status)) {
      NumarkDJ2GO2.leftDeck.shift();
      NumarkDJ2GO2.browser.shift();
      NumarkDJ2GO2.rightDeck.shift();
    }
    else {
      NumarkDJ2GO2.leftDeck.unshift();
      NumarkDJ2GO2.browser.unshift();
      NumarkDJ2GO2.rightDeck.unshift();
    }
  }
});
