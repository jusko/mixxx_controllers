var NumarkDJ2GO2 = new Object({
  channels: [
    '[Channel1]',
    '[Channel2]'
  ]
});

/**
 * Override Pot's connect and disconnect methods to work more smoothly 
 */
components.Pot.prototype.connect = function() {
  engine.softTakeover(this.group, this.inKey, true);
};
components.Pot.prototype.disconnect = function() {
  engine.softTakeoverIgnoreNextValue(this.group, this.inKey);
};

/**
 * Init
 */
NumarkDJ2GO2.init = function (id, debug) {
  NumarkDJ2GO2.leftDeck = new NumarkDJ2GO2.Deck(0);
  NumarkDJ2GO2.rightDeck = new NumarkDJ2GO2.Deck(1);
  NumarkDJ2GO2.browser = new NumarkDJ2GO2.Browser();
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
  for (var i = 0x01; i <= 0x04; ++i) {
    for (var j = 0x00; j <= 0x30; j += 0x10) {
      midi.sendShortMsg(0x94, j + i, 0x00);
      midi.sendShortMsg(0x95, j + i, 0x00);
    }
  }
};

/**
 * Deck
 */
NumarkDJ2GO2.Deck = function (channel) {
  components.Deck.call(this, [channel + 1]);
  this.channel = channel;

  this.playButton = new NumarkDJ2GO2.PlayButton(channel);
  this.cueButton = new NumarkDJ2GO2.CueButton(channel);
  this.syncButton = new components.SyncButton([0x90 + channel, 0x02]);
  this.hotcues = new NumarkDJ2GO2.HotcueButtonPad(channel);
  this.autoloops = new NumarkDJ2GO2.AutoLoopButtonPad(channel);
  this.loops = new NumarkDJ2GO2.ManualLoopButtonPad(channel);
  this.fx = new NumarkDJ2GO2.FXButtonPad(channel);

  this.fader = new NumarkDJ2GO2.Fader(channel);
  this.jogWheel = new NumarkDJ2GO2.JogWheel(channel);

  this.knob1 = new NumarkDJ2GO2.MiddleKnob(channel);
  this.knob2 = new NumarkDJ2GO2.HighKnob(channel);

  this.reconnectComponents(function (component) {
    if (component.group === undefined) {
      component.group = NumarkDJ2GO2.channels[channel];
    }
  });
  this.shiftLocked = false;
  this.flashPflLightTimer = 0;
};
NumarkDJ2GO2.Deck.prototype = Object.create(components.Deck.prototype);

/**
 * Override default shift methods for the container to work better
 * with our requirements
 */
NumarkDJ2GO2.Deck.prototype.shiftable = function(component) {
  return (component instanceof NumarkDJ2GO2.Fader) ||
         (component instanceof NumarkDJ2GO2.JogWheel) ||
         (component instanceof NumarkDJ2GO2.MiddleKnob) ||
         (component instanceof NumarkDJ2GO2.HighKnob);
};
NumarkDJ2GO2.Deck.prototype.shift = function() {
  this.hotcues.shift();
  this.cueButton.shift();
  this.playButton.shift();

  if (this.shiftLocked) {
    return;
  }
  this.reconnectComponents(function(component) {
    if (NumarkDJ2GO2.Deck.prototype.shiftable(component)) {
      component.shift();
    }
  });
};
NumarkDJ2GO2.Deck.prototype.unshift = function() {
  this.hotcues.unshift();
  this.cueButton.unshift();
  this.playButton.unshift();

  if (this.shiftLocked) {
    return;
  }
  this.reconnectComponents(function(component) {
    if (NumarkDJ2GO2.Deck.prototype.shiftable(component)) {
      component.unshift();
    }
  });
};

NumarkDJ2GO2.Deck.prototype.toggleShiftLock = function() {
  if (this.shiftLocked) {
    engine.stopTimer(this.flashPflLightTimer);
    this.flashPflLightTimer = 0;
    val = engine.getValue(NumarkDJ2GO2.channels[this.channel], 'pfl') === 1 ? 0x90 : 0x80;
    engine.beginTimer(250, function() { midi.sendShortMsg(val + this.channel, 0x1B, 0x01); }, true);
    this.shiftLocked = false;
  }
  else {
    this.shiftLocked = true;
    this.flashPflLightTimer = engine.beginTimer(500, function() {
        midi.sendShortMsg(0x90 + this.channel, 0x1B, 0x01);
        engine.beginTimer(250, function() {
          midi.sendShortMsg(0x80 + this.channel, 0x1B, 0x01);
        }, true);
    });
  }
};

/**
 * Middle Knob
 */
NumarkDJ2GO2.MiddleKnob = function (channel) {
  components.Pot.call(this);
  this.midi = [0xBF, (channel === 0 ? 0x0A : 0x0C)];
  this.channel = channel;
  this.inKey = (channel === 0) ? 'gain' : 'headGain';
  this.group = '[Master]';
};
NumarkDJ2GO2.MiddleKnob.prototype = new components.Pot({
  shift: function() {
    this.inKey = 'parameter2';
    this.group = '[EqualizerRack1_[Channel' + (this.channel + 1) + ']_Effect1]';
  },
  unshift: function() {
    this.inKey = (this.channel === 0) ? 'gain' : 'headGain';
    this.group = '[Master]';
  }
});

/**
 * High Knob
 */
NumarkDJ2GO2.HighKnob = function (channel) {
  components.Pot.call(this);
  this.channel = channel;
  this.midi = [0xB0 + channel, 0x16];
  this.group = NumarkDJ2GO2.channels[channel];
  this.inKey = 'pregain';
};
NumarkDJ2GO2.HighKnob.prototype = new components.Pot({
  shift: function() {
    this.inKey = 'parameter3';
    this.group = '[EqualizerRack1_[Channel' + (this.channel + 1) + ']_Effect1]';
  },
  unshift: function() {
    this.inKey = 'pregain';
    this.group = NumarkDJ2GO2.channels[this.channel];
  }
});


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
 * Jog wheel
 */
NumarkDJ2GO2.JogWheel = function (channel) {
  components.Encoder.call(this);
  this.midi = [0xB0 + channel, 0x06];
  this.channel = channel;
}
NumarkDJ2GO2.JogWheel.prototype = new components.Encoder({
  shift: function() {
    this.group = '[EqualizerRack1_[Channel' + (this.channel + 1) + ']_Effect1]';
    this.inKey = 'parameter1';
    this.tick = 0.005;
  },
  unshift: function() {
    this.group = NumarkDJ2GO2.channels[this.channel];
    this.inKey = 'playposition';
    this.tick = 0.001;
  },
  input: function(channel, control, value) {
    if (this.inKey === 'playposition' &&
        engine.getValue(NumarkDJ2GO2.channels[this.channel], 'play') === 1) {

      if (value === 0x01) {
        engine.setValue(this.group, 'rate_perm_up_small', 1);
        engine.beginTimer(500, function() {
          engine.setValue(this.group, 'rate_perm_down_small', 1);
        }, true);
      }
      else if (value === 0x7F) {
        engine.setValue(this.group, 'rate_perm_down_small', 1);
        engine.beginTimer(500, function() {
          engine.setValue(this.group, 'rate_perm_up_small', 1);
        }, true);
      }
    }
    else {
      if (value === 0x01) {
        this.inSetParameter(this.inGetParameter() + this.tick);
      }
      else if (value === 0x7F) {
        this.inSetParameter(this.inGetParameter() - this.tick);
      }
    }
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
  this.inKey = 'rate';
}
NumarkDJ2GO2.Fader.prototype = new components.Pot({
  shift: function() {
    this.inKey = 'volume';
  },
  unshift: function() {
    this.inKey = 'rate';
  },
  inValueScale: function(value) {
    step = this.inKey === 'rate' ? 0.008 : 0.01;
    half = 64;
    if (value >= half) {
      return 0.5 + ((value - half) * step)
    } else {
      return 0.5 - ((half - value) * step)
    }
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
 * FX Toggle Buttons
 */
NumarkDJ2GO2.FXButtonPad = function(channel) {
  NumarkDJ2GO2.ButtonPad.call(this, channel, function(channel, number) {
    group = number === 4 ? NumarkDJ2GO2.channels[channel] : '[EffectRack1_EffectUnit' + (1 + channel) + '_Effect' + number + ']';
    key   = number === 4 ? 'quantize' : 'enabled';

    return new components.Button({
      type: components.Button.prototype.types.toggle,
      midi: [0x94 + channel, 0x30 + number],
      group: group,
      key: key
    });
  });
}
NumarkDJ2GO2.FXButtonPad.prototype = Object.create(NumarkDJ2GO2.ButtonPad.prototype);

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
      var noFX = true;

      if (value === 0x01) {
        for (var i = 1; i <= 2; i++) {
          for (var j = 1; j <= 3; j++) {
            if (engine.getValue('[EffectRack1_EffectUnit' + i + '_Effect' + j + ']', 'enabled') === 1) {
              val = engine.getValue('[EffectRack1_EffectUnit' + i + '_Effect' + j + ']', 'meta');
              engine.setValue('[EffectRack1_EffectUnit' + i + '_Effect' + j + ']', 'meta', val + 0.055);
              noFX = false;
            }
          }
        }
        if (noFX) {
          this.inSetParameter(1);
        }
      }
      else if (value === 0x7F) {
        for (var i = 1; i <= 2; i++) {
          for (var j = 1; j <= 3; j++) {
            if (engine.getValue('[EffectRack1_EffectUnit' + i + '_Effect' + j + ']', 'enabled') === 1) {
              val = engine.getValue('[EffectRack1_EffectUnit' + i + '_Effect' + j + ']', 'meta');
              engine.setValue('[EffectRack1_EffectUnit' + i + '_Effect' + j + ']', 'meta', val - 0.055);
              noFX = false;
            }
          }
        }
        if (noFX) {
          this.inSetParameter(-1);
        }
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
  this.group = NumarkDJ2GO2.channels[this.channel];
  this.inKey = 'LoadSelectedTrack';
}
NumarkDJ2GO2.LoadButton.prototype = new components.Button({
  input: function(channel, control, value, status) {
    if (this.isShifted) {
      if (control === 0x02) {
        NumarkDJ2GO2.leftDeck.toggleShiftLock();
      }
      else if (control === 0x03) {
        NumarkDJ2GO2.rightDeck.toggleShiftLock();
      }
    }
    else {
      this.inSetValue(this.isPress(channel, control, value, status));
    }
  },
  shift: function () {
    this.isShifted = true;
  },
  unshift: function() {
    this.isShifted = false;
  }
});

/**
 * Shift functionality when browse button pressed
 */
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

NumarkDJ2GO2.PlayButton = function(channel) {
  components.PlayButton.call(this);

  this.midi = [0x90 + channel, 0x00];
};
NumarkDJ2GO2.PlayButton.prototype = new components.PlayButton({
  shift: function () {
    this.inKey = 'beatjump_32_forward';
  }
});

NumarkDJ2GO2.CueButton = function(channel) {
  components.CueButton.call(this);

  this.midi = [0x90 + channel, 0x01];
};
NumarkDJ2GO2.CueButton.prototype = new components.CueButton({
  shift: function () {
    this.inKey = 'beatjump_32_backward';
  }
});
